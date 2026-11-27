import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { StockBatch } from '../models/StockBatch.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';

export const stockService = {
  async listStock({ search = '', category = '', filter = 'all', page = 1, limit = 50, userRole = 'staff' } = {}) {
    const isOwner = userRole === 'owner';
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    // Fetch active products
    const productQuery = { isActive: true };
    if (category) productQuery.category = category;
    if (search) {
      productQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { 'variants.sku': { $regex: search, $options: 'i' } },
        { 'variants.barcode': { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(productQuery).populate('category', 'name').lean();

    // Collect all variants
    const rows = [];

    for (const p of products) {
      for (const v of p.variants) {
        if (!v.isActive) continue;

        // Fetch active batches for this variant
        const batches = await StockBatch.find({ variantId: v._id, qtyLeft: { $gt: 0 } })
          .sort({ expiryDate: 1 })
          .lean();

        const totalStock = batches.reduce((sum, b) => sum + b.qtyLeft, 0);
        const lowStockLimit = v.minStockLevel || 3;

        let status = 'in_stock';
        if (totalStock === 0) status = 'out_of_stock';
        else if (totalStock <= lowStockLimit) status = 'low_stock';

        // Check nearest expiry
        const nearestBatchWithExpiry = batches.find((b) => b.expiryDate != null);
        const nearestExpiry = nearestBatchWithExpiry ? nearestBatchWithExpiry.expiryDate : null;

        let expiryStatus = 'ok';
        if (nearestExpiry) {
          if (new Date(nearestExpiry) < now) expiryStatus = 'expired';
          else if (new Date(nearestExpiry) <= in30Days) expiryStatus = 'expiring_30d';
          else if (new Date(nearestExpiry) <= in60Days) expiryStatus = 'expiring_60d';
        }

        // Apply tab filter
        if (filter === 'low_stock' && status !== 'low_stock') continue;
        if (filter === 'out_of_stock' && status !== 'out_of_stock') continue;
        if (filter === 'expiring_30d' && expiryStatus !== 'expiring_30d' && expiryStatus !== 'expired') continue;
        if (filter === 'expiring_60d' && expiryStatus !== 'expiring_60d' && expiryStatus !== 'expiring_30d' && expiryStatus !== 'expired') continue;
        if (filter === 'expired' && expiryStatus !== 'expired') continue;

        const stockValuePaise = isOwner
          ? batches.reduce((sum, b) => sum + b.qtyLeft * b.unitCostPaise, 0)
          : undefined;

        rows.push({
          productId: p._id,
          productName: p.name,
          brand: p.brand,
          categoryName: p.category?.name || 'Uncategorized',
          variantId: v._id,
          flavour: v.flavour || '',
          size: v.size || '',
          sku: v.sku,
          barcode: v.barcode || '',
          mrp: v.mrp,
          sellingPrice: v.sellingPrice,
          purchasePrice: isOwner ? v.purchasePrice : undefined,
          stock: totalStock,
          lowStockLimit,
          status,
          nearestExpiry,
          expiryStatus,
          stockValuePaise,
          batchCount: batches.length,
        });
      }
    }

    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedRows = rows.slice(startIndex, startIndex + Number(limit));

    // Summary stats
    const totalItems = rows.length;
    const lowStockCount = rows.filter((r) => r.status === 'low_stock').length;
    const outOfStockCount = rows.filter((r) => r.status === 'out_of_stock').length;
    const expiringSoonCount = rows.filter((r) => r.expiryStatus === 'expiring_30d' || r.expiryStatus === 'expiring_60d').length;
    const expiredCount = rows.filter((r) => r.expiryStatus === 'expired').length;
    const totalStockValuePaise = isOwner
      ? rows.reduce((sum, r) => sum + (r.stockValuePaise || 0), 0)
      : undefined;

    return {
      items: paginatedRows,
      total: totalItems,
      page: Number(page),
      pages: Math.ceil(totalItems / Number(limit)),
      stats: {
        totalItems,
        lowStockCount,
        outOfStockCount,
        expiringSoonCount,
        expiredCount,
        totalStockValuePaise,
      },
    };
  },

  async getVariantStock(variantId, userRole = 'staff') {
    const isOwner = userRole === 'owner';

    const batches = await StockBatch.find({ variantId })
      .populate('purchaseId', 'purchaseNo supplierInvoiceNo invoiceDate')
      .sort({ expiryDate: 1, createdAt: -1 })
      .lean();

    const movements = await StockMovement.find({ variantId })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Redact costs for staff
    const sanitizedBatches = batches.map((b) => ({
      _id: b._id,
      batchNo: b.batchNo,
      expiryDate: b.expiryDate,
      qtyReceived: b.qtyReceived,
      qtyLeft: b.qtyLeft,
      unitCostPaise: isOwner ? b.unitCostPaise : undefined,
      purchaseNo: isOwner ? b.purchaseId?.purchaseNo : undefined,
      createdAt: b.createdAt,
    }));

    return {
      batches: sanitizedBatches,
      movements,
    };
  },

  async adjustStock({ batchId, qty, direction, reason, notes = '', userId }) {
    if (!batchId) throw new Error('Batch ID is required');
    if (!qty || Number(qty) <= 0) throw new Error('Quantity must be greater than zero');
    if (!['increase', 'decrease'].includes(direction)) throw new Error('Invalid direction');
    if (!['damaged', 'expired', 'lost', 'counting_correction'].includes(reason)) {
      throw new Error('Valid reason required (damaged, expired, lost, counting_correction)');
    }

    const batch = await StockBatch.findById(batchId);
    if (!batch) throw new Error('Batch not found');

    const numQty = Number(qty);
    const movementQty = direction === 'increase' ? numQty : -numQty;

    if (direction === 'decrease' && batch.qtyLeft < numQty) {
      throw new Error(`Cannot decrease stock: batch only has ${batch.qtyLeft} units available`);
    }

    batch.qtyLeft += movementQty;
    await batch.save();

    const movement = await StockMovement.create({
      productId: batch.productId,
      variantId: batch.variantId,
      batchId: batch._id,
      qty: movementQty,
      type: 'adjustment',
      reason,
      refType: 'adjustment',
      refId: batch._id,
      balanceAfter: batch.qtyLeft,
      createdBy: userId,
    });

    await AuditLog.create({
      userId,
      action: 'STOCK_ADJUSTMENT',
      refType: 'StockBatch',
      refId: batch._id,
      details: {
        batchNo: batch.batchNo,
        direction,
        qty: numQty,
        reason,
        notes,
        balanceAfter: batch.qtyLeft,
      },
    });

    return { batch, movement };
  },

  /**
   * FEFO Batch Allocation Helper:
   * Finds earliest expiring active batches for checkout.
   */
  async allocateBatches(variantId, requestedQty, session = null) {
    const now = new Date();
    const query = {
      variantId: new mongoose.Types.ObjectId(variantId.toString()),
      qtyLeft: { $gt: 0 },
      $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }],
    };

    const batches = await StockBatch.find(query)
      .sort({ expiryDate: 1, createdAt: 1 })
      .session(session);

    const totalAvailable = batches.reduce((sum, b) => sum + b.qtyLeft, 0);
    if (totalAvailable < requestedQty) {
      throw new Error(`Insufficient stock: requested ${requestedQty}, only ${totalAvailable} available`);
    }

    let remaining = requestedQty;
    const allocations = [];

    for (const b of batches) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, b.qtyLeft);
      allocations.push({
        batchId: b._id,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
        qty: alloc,
        unitCostPaise: b.unitCostPaise,
      });
      remaining -= alloc;
    }

    return allocations;
  },

  async getAlerts() {
    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const products = await Product.find({ isActive: true }).lean();
    let lowStockCount = 0;
    const lowStockItems = [];

    for (const p of products) {
      for (const v of p.variants) {
        if (!v.isActive) continue;
        const batches = await StockBatch.find({ variantId: v._id, qtyLeft: { $gt: 0 } }).lean();
        const total = batches.reduce((s, b) => s + b.qtyLeft, 0);
        const limit = v.minStockLevel || 3;
        if (total <= limit) {
          lowStockCount++;
          if (lowStockItems.length < 5) {
            lowStockItems.push({
              productName: p.name,
              flavour: v.flavour,
              size: v.size,
              stock: total,
              limit,
            });
          }
        }
      }
    }

    const expiringBatches = await StockBatch.find({
      qtyLeft: { $gt: 0 },
      expiryDate: { $ne: null, $lte: in60Days },
    })
      .populate('productId', 'name')
      .sort({ expiryDate: 1 })
      .limit(10)
      .lean();

    return {
      lowStock: {
        count: lowStockCount,
        items: lowStockItems,
      },
      expiringSoon: {
        count: expiringBatches.length,
        items: expiringBatches.map((b) => ({
          productName: b.productId?.name || 'Product',
          batchNo: b.batchNo,
          expiryDate: b.expiryDate,
          qtyLeft: b.qtyLeft,
        })),
      },
    };
  },
};
