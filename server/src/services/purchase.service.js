import mongoose from 'mongoose';
import { Purchase } from '../models/Purchase.js';
import { Product } from '../models/Product.js';
import { StockBatch } from '../models/StockBatch.js';
import { StockMovement } from '../models/StockMovement.js';
import { SupplierPayment } from '../models/SupplierPayment.js';
import { nextSeq, getFinancialYear } from '../models/Counter.js';

export const purchaseService = {
  async list({ supplierId, status = 'all', paymentStatus = 'all', page = 1, limit = 50 } = {}) {
    const filter = {};
    if (supplierId) filter.supplierId = supplierId;
    if (status !== 'all') filter.status = status;
    if (paymentStatus !== 'all') filter.paymentStatus = paymentStatus;

    const skip = (Number(page) - 1) * Number(limit);
    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .populate('supplierId', 'name phone gstin')
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Purchase.countDocuments(filter),
    ]);

    return { purchases, total, page: Number(page), pages: Math.ceil(total / Number(limit)) };
  },

  async getById(id) {
    const purchase = await Purchase.findById(id).populate('supplierId', 'name phone gstin address');
    if (!purchase) throw new Error('Purchase invoice not found');
    return purchase;
  },

  async createPurchase(data, userId) {
    const { supplierId, supplierInvoiceNo, invoiceDate, items, paidPaise = 0, paymentMode = 'cash', refNo = '', idempotencyKey } = data;

    if (!supplierId) throw new Error('Supplier is required');
    if (!supplierInvoiceNo) throw new Error('Supplier invoice number is required');
    if (!items || items.length === 0) throw new Error('At least one item is required');

    // Idempotency check
    if (idempotencyKey) {
      const existing = await Purchase.findOne({ idempotencyKey });
      if (existing) return existing;
    }

    const fy = getFinancialYear(invoiceDate ? new Date(invoiceDate) : new Date());
    const seq = await nextSeq(`PU_${fy}`);
    const purchaseNo = `PU/${fy}/${String(seq).padStart(4, '0')}`;

    let subtotalPaise = 0;
    let gstPaise = 0;
    let totalPaise = 0;

    const processedItems = [];

    // Calculate line items
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new Error(`Product not found: ${item.productId}`);

      const variant = product.variants.id(item.variantId);
      if (!variant) throw new Error(`Variant not found: ${item.variantId}`);

      const qty = Number(item.qty);
      const unitCostPaise = Number(item.unitCostPaise);
      const gstRate = Number(item.gstRate ?? product.gstRate ?? 18);

      const lineTaxablePaise = qty * unitCostPaise;
      const lineGstPaise = Math.round(lineTaxablePaise * (gstRate / 100));
      const lineTotalPaise = lineTaxablePaise + lineGstPaise;

      subtotalPaise += lineTaxablePaise;
      gstPaise += lineGstPaise;
      totalPaise += lineTotalPaise;

      // Expiry handling
      let expiryDate = null;
      if (item.expiryDate) {
        const parsedExpiry = new Date(item.expiryDate);
        // Set to end of month if provided
        expiryDate = new Date(Date.UTC(parsedExpiry.getUTCFullYear(), parsedExpiry.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      }

      processedItems.push({
        productId: product._id,
        variantId: variant._id,
        nameSnapshot: product.name,
        flavour: variant.flavour || '',
        size: variant.size || '',
        qty,
        unitCostPaise,
        gstRate,
        batchNo: item.batchNo.trim(),
        expiryDate,
        lineTaxablePaise,
        lineGstPaise,
        lineTotalPaise,
      });
    }

    const initialPaidPaise = Math.min(Number(paidPaise) || 0, totalPaise);
    const duePaise = totalPaise - initialPaidPaise;
    const paymentStatus = duePaise === 0 ? 'paid' : initialPaidPaise > 0 ? 'partial' : 'unpaid';

    // Create Purchase document
    const purchase = new Purchase({
      purchaseNo,
      supplierId,
      supplierInvoiceNo: supplierInvoiceNo.trim(),
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      items: processedItems,
      subtotalPaise,
      gstPaise,
      totalPaise,
      paidPaise: initialPaidPaise,
      duePaise,
      paymentStatus,
      status: 'active',
      createdBy: userId,
      idempotencyKey,
    });

    await purchase.save();

    // Now update or create stock batches and movements
    for (let i = 0; i < purchase.items.length; i++) {
      const line = purchase.items[i];

      // Check if batch exists with exact variantId + batchNo + expiryDate
      let batch = await StockBatch.findOne({
        variantId: line.variantId,
        batchNo: line.batchNo,
        expiryDate: line.expiryDate,
      });

      if (batch) {
        batch.qtyReceived += line.qty;
        batch.qtyLeft += line.qty;
        batch.unitCostPaise = line.unitCostPaise;
        batch.purchaseId = purchase._id;
        await batch.save();
      } else {
        batch = await StockBatch.create({
          productId: line.productId,
          variantId: line.variantId,
          batchNo: line.batchNo,
          expiryDate: line.expiryDate,
          qtyReceived: line.qty,
          qtyLeft: line.qty,
          unitCostPaise: line.unitCostPaise,
          purchaseId: purchase._id,
        });
      }

      // Link batchId in purchase item
      line.batchId = batch._id;

      // Create StockMovement
      await StockMovement.create({
        productId: line.productId,
        variantId: line.variantId,
        batchId: batch._id,
        qty: line.qty,
        type: 'purchase',
        reason: 'other',
        refType: 'purchase',
        refId: purchase._id,
        balanceAfter: batch.qtyLeft,
        createdBy: userId,
      });

      // Update variant's purchasePrice to latest unit cost
      await Product.updateOne(
        { _id: line.productId, 'variants._id': line.variantId },
        { $set: { 'variants.$.purchasePrice': line.unitCostPaise } }
      );
    }

    await purchase.save();

    // Record initial supplier payment if paid now
    if (initialPaidPaise > 0) {
      await SupplierPayment.create({
        supplierId,
        purchaseId: purchase._id,
        amountPaise: initialPaidPaise,
        mode: paymentMode,
        refNo,
        createdBy: userId,
      });
    }

    return purchase;
  },

  async voidPurchase(id, voidReason, userId) {
    if (!voidReason || !voidReason.trim()) {
      throw new Error('Void reason is required');
    }

    const purchase = await Purchase.findById(id);
    if (!purchase) throw new Error('Purchase invoice not found');
    if (purchase.status === 'voided') throw new Error('Purchase is already voided');

    // Rule: Permitted ONLY if for every batch created by that purchase, qtyLeft === qtyReceived
    for (const item of purchase.items) {
      const batch = await StockBatch.findById(item.batchId);
      if (!batch) continue;

      if (batch.qtyLeft < item.qty) {
        throw new Error(
          `Cannot void purchase: Batch ${batch.batchNo} has already been sold or adjusted (Remaining: ${batch.qtyLeft}, Purchased: ${item.qty}). Perform a manual stock adjustment instead.`
        );
      }
    }

    // Reverse stock batches and write purchase_void movements
    for (const item of purchase.items) {
      const batch = await StockBatch.findById(item.batchId);
      if (!batch) continue;

      batch.qtyLeft -= item.qty;
      batch.qtyReceived -= item.qty;
      await batch.save();

      await StockMovement.create({
        productId: item.productId,
        variantId: item.variantId,
        batchId: batch._id,
        qty: -item.qty,
        type: 'purchase_void',
        reason: 'void',
        refType: 'purchase',
        refId: purchase._id,
        balanceAfter: batch.qtyLeft,
        createdBy: userId,
      });
    }

    purchase.status = 'voided';
    purchase.voidReason = voidReason.trim();
    await purchase.save();

    return purchase;
  },
};
