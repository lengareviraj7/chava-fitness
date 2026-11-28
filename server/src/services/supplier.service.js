import mongoose from 'mongoose';
import { Supplier } from '../models/Supplier.js';
import { Purchase } from '../models/Purchase.js';
import { SupplierPayment } from '../models/SupplierPayment.js';

export const supplierService = {
  async list({ search = '', isActive = 'all' } = {}) {
    const filter = {};
    if (isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
      ];
    }
    const suppliers = await Supplier.find(filter).sort({ name: 1 }).lean();

    // Aggregate pending dues and total purchased for each supplier
    const dues = await Purchase.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: '$supplierId',
          pendingDuePaise: { $sum: '$duePaise' },
          totalPurchasedPaise: { $sum: '$totalPaise' },
        },
      },
    ]);
    const dueMap = new Map(dues.map((d) => [String(d._id), d]));

    return suppliers.map((s) => {
      const stats = dueMap.get(String(s._id)) || {};
      return {
        ...s,
        pendingDuePaise: stats.pendingDuePaise || 0,
        totalPurchasedPaise: stats.totalPurchasedPaise || 0,
      };
    });
  },

  async getById(id) {
    const supplier = await Supplier.findById(id);
    if (!supplier) throw new Error('Supplier not found');
    return supplier;
  },

  async create(data) {
    return Supplier.create(data);
  },

  async update(id, data) {
    const supplier = await Supplier.findByIdAndUpdate(id, data, { new: true });
    if (!supplier) throw new Error('Supplier not found');
    return supplier;
  },

  async getSummary(id) {
    const supplier = await Supplier.findById(id);
    if (!supplier) throw new Error('Supplier not found');

    const purchases = await Purchase.find({ supplierId: id, status: 'active' }).sort({ invoiceDate: -1 });
    const payments = await SupplierPayment.find({ supplierId: id }).sort({ paidAt: -1 });

    const totalPurchasedPaise = purchases.reduce((sum, p) => sum + p.totalPaise, 0);
    const totalPaidPaise = purchases.reduce((sum, p) => sum + p.paidPaise, 0);
    const pendingDuePaise = purchases.reduce((sum, p) => sum + p.duePaise, 0);

    return {
      supplier,
      totalPurchasedPaise,
      totalPaidPaise,
      pendingDuePaise,
      purchases,
      payments,
    };
  },

  async recordPayment({ supplierId, purchaseId = null, amountPaise, mode, refNo = '', userId }) {
    if (!amountPaise || amountPaise <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) throw new Error('Supplier not found');

    // If specific purchase is targeted
    if (purchaseId) {
      const purchase = await Purchase.findOne({ _id: purchaseId, supplierId, status: 'active' });
      if (!purchase) throw new Error('Active purchase invoice not found');
      if (amountPaise > purchase.duePaise) {
        throw new Error(`Payment cannot exceed pending due of ${purchase.duePaise} paise`);
      }

      purchase.paidPaise += amountPaise;
      purchase.duePaise -= amountPaise;
      purchase.paymentStatus = purchase.duePaise === 0 ? 'paid' : 'partial';
      await purchase.save();

      const payment = await SupplierPayment.create({
        supplierId,
        purchaseId,
        amountPaise,
        mode,
        refNo,
        createdBy: userId,
      });

      return { payment, purchase };
    }

    // Otherwise, FIFO allocation across unpaid/partial purchases
    const unpaidPurchases = await Purchase.find({
      supplierId,
      status: 'active',
      duePaise: { $gt: 0 },
    }).sort({ invoiceDate: 1 });

    const totalPending = unpaidPurchases.reduce((sum, p) => sum + p.duePaise, 0);
    if (amountPaise > totalPending) {
      throw new Error(`Payment exceeds total outstanding supplier balance of ${totalPending} paise`);
    }

    let remainingToPay = amountPaise;
    for (const p of unpaidPurchases) {
      if (remainingToPay <= 0) break;
      const alloc = Math.min(remainingToPay, p.duePaise);
      p.paidPaise += alloc;
      p.duePaise -= alloc;
      p.paymentStatus = p.duePaise === 0 ? 'paid' : 'partial';
      await p.save();
      remainingToPay -= alloc;
    }

    const payment = await SupplierPayment.create({
      supplierId,
      purchaseId: null,
      amountPaise,
      mode,
      refNo,
      createdBy: userId,
    });

    return { payment };
  },
};
