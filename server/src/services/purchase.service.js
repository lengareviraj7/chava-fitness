import mongoose from 'mongoose';
import { Purchase } from '../models/Purchase.js';
import { Product } from '../models/Product.js';
import { StockBatch } from '../models/StockBatch.js';
import { StockMovement } from '../models/StockMovement.js';
import { SupplierPayment } from '../models/SupplierPayment.js';
import { Brand } from '../models/Brand.js';
import { AuditLog } from '../models/AuditLog.js';
import { nextSeq, getFinancialYear } from '../models/Counter.js';
import { normalizeDupKey } from '../utils/dupKey.js';
import { generateSku } from '../utils/sku.js';
import { failpoint } from '../utils/failpoint.js';

function parseExpiryMonth(input, trackExpiry = true) {
  if (trackExpiry === false) return null;
  if (!input) {
    const err = new Error('Expiry date is required for products tracking expiry');
    err.code = 'EXPIRY_FORMAT_INVALID';
    err.statusCode = 400;
    throw err;
  }

  let month = 0;
  let year = 0;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 2) {
        month = parseInt(parts[0], 10);
        year = parseInt(parts[1], 10);
      }
    } else if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length >= 2) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
      }
    }
  } else if (input instanceof Date && !isNaN(input.getTime())) {
    year = input.getUTCFullYear();
    month = input.getUTCMonth() + 1;
  }

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12 || year < 1000) {
    const err = new Error('Invalid expiry date format. Please use MM/YYYY');
    err.code = 'EXPIRY_FORMAT_INVALID';
    err.statusCode = 400;
    throw err;
  }

  // Calculate last day of specified month in UTC (month is 1-indexed, day 0 gives last day)
  const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  if (lastDay.getTime() < Date.now()) {
    const err = new Error('Expiry date cannot be in the past');
    err.code = 'EXPIRY_IN_PAST';
    err.statusCode = 400;
    throw err;
  }

  return lastDay;
}

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
    const {
      supplierId,
      supplierInvoiceNo,
      invoiceDate,
      items,
      paidPaise = 0,
      paymentMode = 'cash',
      refNo = '',
      idempotencyKey,
      newProducts = [],
      newVariants = [],
    } = data;

    if (!supplierId) throw new Error('Supplier is required');
    if (!supplierInvoiceNo) throw new Error('Supplier invoice number is required');
    if (!items || items.length === 0) throw new Error('At least one item is required');

    // 1. Idempotency check: if already processed, return existing
    if (idempotencyKey) {
      const existing = await Purchase.findOne({ idempotencyKey }).populate('supplierId', 'name phone gstin');
      if (existing) return existing;
    }

    // Try starting a session & transaction if replica set is available
    let session = null;
    let inTx = false;
    const topo = mongoose.connection?.client?.topology?.description;
    const canUseTx = topo && (topo.type === 'ReplicaSetWithPrimary' || topo.type === 'Sharded' || !!topo.setName);

    if (canUseTx) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        inTx = true;
      } catch {
        session = null;
        inTx = false;
      }
    }

    // Rollback tracker for robust atomicity in all environments
    const createdProductIds = [];
    const appendedVariantRefs = [];
    const createdBatchIds = [];
    const createdMovementIds = [];
    let createdPaymentId = null;
    let createdPurchaseId = null;

    try {
      // 2. Validate and process newProducts
      const tempVarMap = new Map();
      const seenBarcodes = new Set();
      const seenSkus = new Set();

      for (const np of newProducts) {
        const categoryId = np.categoryId || np.category;
        if (!np.name || !np.brand || !categoryId) {
          const err = new Error('Product name, brand, and category are required');
          err.code = 'NEW_PRODUCT_INVALID';
          err.statusCode = 400;
          throw err;
        }

        if (np.gstRate === undefined || np.gstRate === null || ![0, 5, 12, 18, 28].includes(Number(np.gstRate))) {
          const err = new Error('GST rate is required for new products and must be chosen explicitly');
          err.code = 'GST_RATE_REQUIRED';
          err.statusCode = 400;
          throw err;
        }

        const dupKey = normalizeDupKey(np.brand, np.name, categoryId);
        const dupQuery = { dupKey, isActive: true };
        const existingProd = session
          ? await Product.findOne(dupQuery).session(session)
          : await Product.findOne(dupQuery);

        if (existingProd) {
          const err = new Error(`${existingProd.brand} ${existingProd.name} already exists. Use it and add a new flavour / size?`);
          err.code = 'PRODUCT_EXISTS';
          err.statusCode = 409;
          err.existingProduct = {
            _id: existingProd._id,
            name: existingProd.name,
            brand: existingProd.brand,
            category: existingProd.category,
            variants: existingProd.variants,
          };
          throw err;
        }

        // Validate variants of new product
        if (!np.variants || np.variants.length === 0) {
          const err = new Error('At least one variant is required for new product');
          err.code = 'NEW_PRODUCT_INVALID';
          err.statusCode = 400;
          throw err;
        }

        const preparedVariants = [];
        for (const v of np.variants) {
          const mrp = Number(v.mrpPaise ?? v.mrp ?? 0);
          const sellingPrice = Number(v.sellingPricePaise ?? v.sellingPrice ?? mrp);

          if (mrp <= 0) {
            const err = new Error('MRP must be a positive number');
            err.code = 'NEW_PRODUCT_INVALID';
            err.statusCode = 400;
            throw err;
          }

          if (sellingPrice > mrp) {
            const err = new Error('Selling price cannot exceed MRP');
            err.code = 'SELLING_PRICE_ABOVE_MRP';
            err.statusCode = 400;
            throw err;
          }

          if (v.barcode && v.barcode.trim()) {
            const cleanBarcode = v.barcode.trim();
            if (seenBarcodes.has(cleanBarcode)) {
              const err = new Error(`Duplicate barcode within request: ${cleanBarcode}`);
              err.code = 'BARCODE_EXISTS';
              err.statusCode = 409;
              throw err;
            }
            const barProd = session
              ? await Product.findOne({ 'variants.barcode': cleanBarcode, isActive: true }).session(session)
              : await Product.findOne({ 'variants.barcode': cleanBarcode, isActive: true });

            if (barProd) {
              const err = new Error(`Barcode ${cleanBarcode} is already assigned to ${barProd.brand} ${barProd.name}`);
              err.code = 'BARCODE_EXISTS';
              err.statusCode = 409;
              err.existingProduct = barProd;
              throw err;
            }
            seenBarcodes.add(cleanBarcode);
          }

          let sku = v.sku?.trim();
          if (!sku) {
            const baseSku = generateSku({
              brand: np.brand,
              name: np.name,
              flavour: v.flavour,
              size: v.size,
            });
            sku = baseSku;
            let counter = 1;
            while (
              seenSkus.has(sku) ||
              (session
                ? await Product.exists({ 'variants.sku': sku }).session(session)
                : await Product.exists({ 'variants.sku': sku }))
            ) {
              sku = `${baseSku}-${counter++}`;
            }
          }
          seenSkus.add(sku);

          preparedVariants.push({
            name: `${v.flavour || 'Standard'} ${v.size || ''}`.trim(),
            flavour: v.flavour || 'Standard',
            size: v.size || 'Standard',
            sku,
            barcode: v.barcode ? v.barcode.trim() : null,
            mrp,
            sellingPrice,
            purchasePrice: Number(v.purchasePrice ?? v.purchasePricePaise ?? (v.unitCostRupees ? Math.round(Number(v.unitCostRupees) * 100) : 0) ?? (v.unitCostPaise ? Number(v.unitCostPaise) : 0)) || 0,
            stock: 0,
            minStockLevel: np.lowStockLimit ?? 3,
            tempId: v.tempId || v.tempVariantId,
          });
        }

        // Auto-upsert brand
        await Brand.findOneAndUpdate(
          { name: np.brand.trim() },
          { name: np.brand.trim() },
          { upsert: true, new: true, ...(session ? { session } : {}) }
        );

        const newProd = new Product({
          name: np.name.trim(),
          brand: np.brand.trim(),
          category: categoryId,
          hsn: np.hsn ? np.hsn.trim() : '21069099',
          gstRate: Number(np.gstRate),
          trackExpiry: np.trackExpiry !== false,
          lowStockLimit: Number(np.lowStockLimit ?? 3),
          dupKey,
          variants: preparedVariants.map(({ tempId: _t, ...rest }) => rest),
        });

        if (session) {
          await newProd.save({ session });
        } else {
          await newProd.save();
        }
        createdProductIds.push(newProd._id);

        // Map tempIds to real ObjectIds
        for (let i = 0; i < preparedVariants.length; i++) {
          const tId = preparedVariants[i].tempId;
          const realVar = newProd.variants[i];
          if (tId) {
            tempVarMap.set(tId, {
              productId: newProd._id,
              variantId: realVar._id,
              nameSnapshot: newProd.name,
              flavour: realVar.flavour,
              size: realVar.size,
              gstRate: newProd.gstRate,
              trackExpiry: newProd.trackExpiry,
            });
          }
        }

        // Audit log
        await AuditLog.create(
          [
            {
              userId,
              action: 'create_product_via_purchase',
              refType: 'Product',
              refId: newProd._id,
              details: {
                name: newProd.name,
                brand: newProd.brand,
                variantsCount: newProd.variants.length,
              },
            },
          ],
          session ? { session } : {}
        );
      }

      failpoint('purchase_inward_product_create');

      // 3. Process newVariants on existing products
      for (const nv of newVariants) {
        const prod = session
          ? await Product.findById(nv.productId).session(session)
          : await Product.findById(nv.productId);

        if (!prod) {
          const err = new Error(`Product not found for new variant: ${nv.productId}`);
          err.code = 'NEW_PRODUCT_INVALID';
          err.statusCode = 400;
          throw err;
        }

        const mrp = Number(nv.mrpPaise ?? nv.mrp ?? 0);
        const sellingPrice = Number(nv.sellingPricePaise ?? nv.sellingPrice ?? mrp);

        if (mrp <= 0) {
          const err = new Error('MRP must be a positive number');
          err.code = 'NEW_PRODUCT_INVALID';
          err.statusCode = 400;
          throw err;
        }

        if (sellingPrice > mrp) {
          const err = new Error('Selling price cannot exceed MRP');
          err.code = 'SELLING_PRICE_ABOVE_MRP';
          err.statusCode = 400;
          throw err;
        }

        if (nv.barcode && nv.barcode.trim()) {
          const cleanBarcode = nv.barcode.trim();
          if (seenBarcodes.has(cleanBarcode)) {
            const err = new Error(`Duplicate barcode within request: ${cleanBarcode}`);
            err.code = 'BARCODE_EXISTS';
            err.statusCode = 409;
            throw err;
          }
          const barProd = session
            ? await Product.findOne({ 'variants.barcode': cleanBarcode, isActive: true }).session(session)
            : await Product.findOne({ 'variants.barcode': cleanBarcode, isActive: true });

          if (barProd) {
            const err = new Error(`Barcode ${cleanBarcode} is already assigned to ${barProd.brand} ${barProd.name}`);
            err.code = 'BARCODE_EXISTS';
            err.statusCode = 409;
            err.existingProduct = barProd;
            throw err;
          }
          seenBarcodes.add(cleanBarcode);
        }

        let sku = nv.sku?.trim();
        if (!sku) {
          const baseSku = generateSku({
            brand: prod.brand,
            name: prod.name,
            flavour: nv.flavour,
            size: nv.size,
          });
          sku = baseSku;
          let counter = 1;
          while (
            seenSkus.has(sku) ||
            (session
              ? await Product.exists({ 'variants.sku': sku }).session(session)
              : await Product.exists({ 'variants.sku': sku }))
          ) {
            sku = `${baseSku}-${counter++}`;
          }
        }
        seenSkus.add(sku);

        const newVarData = {
          name: `${nv.flavour || 'Standard'} ${nv.size || ''}`.trim(),
          flavour: nv.flavour || 'Standard',
          size: nv.size || 'Standard',
          sku,
          barcode: nv.barcode ? nv.barcode.trim() : null,
          mrp,
          sellingPrice,
          purchasePrice: Number(nv.purchasePrice ?? nv.purchasePricePaise ?? (nv.unitCostRupees ? Math.round(Number(nv.unitCostRupees) * 100) : 0) ?? (nv.unitCostPaise ? Number(nv.unitCostPaise) : 0)) || 0,
          stock: 0,
          minStockLevel: prod.lowStockLimit ?? 3,
        };

        prod.variants.push(newVarData);
        if (session) {
          await prod.save({ session });
        } else {
          await prod.save();
        }

        const addedVar = prod.variants[prod.variants.length - 1];
        appendedVariantRefs.push({ productId: prod._id, variantId: addedVar._id });

        const matchedTempId = nv.tempId || nv.tempVariantId;
        if (matchedTempId) {
          tempVarMap.set(matchedTempId, {
            productId: prod._id,
            variantId: addedVar._id,
            nameSnapshot: prod.name,
            flavour: addedVar.flavour,
            size: addedVar.size,
            gstRate: prod.gstRate,
            trackExpiry: prod.trackExpiry,
          });
        }
      }

      failpoint('purchase_inward_variant_create');

      // 4. Resolve purchase line items
      const fy = getFinancialYear(invoiceDate ? new Date(invoiceDate) : new Date());
      const seq = await nextSeq(`PU_${fy}`, session);
      const purchaseNo = `PU/${fy}/${String(seq).padStart(4, '0')}`;

      let subtotalPaise = 0;
      let gstPaise = 0;
      let totalPaise = 0;
      const processedItems = [];

      for (const item of items) {
        let prodId = item.productId;
        let varId = item.variantId;
        let nameSnapshot = '';
        let flavour = '';
        let size = '';
        let gstRate = item.gstRate;
        let trackExpiry = true;

        if (item.tempVariantId) {
          const mapped = tempVarMap.get(item.tempVariantId);
          if (!mapped) {
            const err = new Error(`Line references invalid tempVariantId: ${item.tempVariantId}`);
            err.code = 'TEMP_REFERENCE_INVALID';
            err.statusCode = 400;
            throw err;
          }
          prodId = mapped.productId;
          varId = mapped.variantId;
          nameSnapshot = mapped.nameSnapshot;
          flavour = mapped.flavour;
          size = mapped.size;
          gstRate = mapped.gstRate;
          trackExpiry = mapped.trackExpiry;
        } else {
          const product = session
            ? await Product.findById(item.productId).session(session)
            : await Product.findById(item.productId);

          if (!product) {
            const err = new Error(`Product not found: ${item.productId}`);
            err.code = 'NEW_PRODUCT_INVALID';
            err.statusCode = 400;
            throw err;
          }

          const variant = product.variants.id(item.variantId);
          if (!variant) {
            const err = new Error(`Variant not found: ${item.variantId}`);
            err.code = 'NEW_PRODUCT_INVALID';
            err.statusCode = 400;
            throw err;
          }

          prodId = product._id;
          varId = variant._id;
          nameSnapshot = product.name;
          flavour = variant.flavour || '';
          size = variant.size || '';
          gstRate = Number(item.gstRate ?? product.gstRate ?? 0);
          trackExpiry = product.trackExpiry !== false;
        }

        const qty = Number(item.qty);
        if (isNaN(qty) || qty <= 0) {
          throw new Error('Quantity must be a positive integer');
        }

        const unitCostPaise = Number(item.unitCostPaise ?? (item.unitCostRupees ? Math.round(Number(item.unitCostRupees) * 100) : 0));
        if (isNaN(unitCostPaise) || unitCostPaise < 0) {
          throw new Error('Unit cost must be a non-negative amount');
        }

        const lineTaxablePaise = qty * unitCostPaise;
        const lineGstPaise = Math.round(lineTaxablePaise * (Number(gstRate || 0) / 100));
        const lineTotalPaise = lineTaxablePaise + lineGstPaise;

        subtotalPaise += lineTaxablePaise;
        gstPaise += lineGstPaise;
        totalPaise += lineTotalPaise;

        // Expiry parsing and past-date validation
        const expiryDate = parseExpiryMonth(item.expiryMonth || item.expiryDate, trackExpiry);

        if (!item.batchNo || !item.batchNo.trim()) {
          throw new Error('Batch number is required for inward items');
        }

        processedItems.push({
          productId: prodId,
          variantId: varId,
          nameSnapshot,
          flavour,
          size,
          qty,
          unitCostPaise,
          gstRate: Number(gstRate || 0),
          batchNo: item.batchNo.trim(),
          expiryDate,
          lineTaxablePaise,
          lineGstPaise,
          lineTotalPaise,
        });
      }

      failpoint('purchase_inward_batch_create');

      const initialPaidPaise = Math.min(Number(paidPaise) || 0, totalPaise);
      const duePaise = totalPaise - initialPaidPaise;
      const paymentStatus = duePaise === 0 ? 'paid' : initialPaidPaise > 0 ? 'partial' : 'unpaid';

      // 5. Create Purchase document
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

      if (session) {
        await purchase.save({ session });
      } else {
        await purchase.save();
      }
      createdPurchaseId = purchase._id;

      // 6. Update or create stock batches & movements
      for (let i = 0; i < purchase.items.length; i++) {
        const line = purchase.items[i];

        const batchQuery = {
          variantId: line.variantId,
          batchNo: line.batchNo,
          expiryDate: line.expiryDate,
        };

        let batch = session
          ? await StockBatch.findOne(batchQuery).session(session)
          : await StockBatch.findOne(batchQuery);

        if (batch) {
          batch.qtyReceived += line.qty;
          batch.qtyLeft += line.qty;
          batch.unitCostPaise = line.unitCostPaise;
          batch.purchaseId = purchase._id;
          if (session) {
            await batch.save({ session });
          } else {
            await batch.save();
          }
        } else {
          const newBatchData = {
            productId: line.productId,
            variantId: line.variantId,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate,
            qtyReceived: line.qty,
            qtyLeft: line.qty,
            unitCostPaise: line.unitCostPaise,
            purchaseId: purchase._id,
          };
          if (session) {
            const [nb] = await StockBatch.create([newBatchData], { session });
            batch = nb;
          } else {
            batch = await StockBatch.create(newBatchData);
          }
          createdBatchIds.push(batch._id);
        }

        line.batchId = batch._id;

        // Stock movement
        const mvData = {
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
        };

        if (session) {
          const [mv] = await StockMovement.create([mvData], { session });
          createdMovementIds.push(mv._id);
        } else {
          const mv = await StockMovement.create(mvData);
          createdMovementIds.push(mv._id);
        }

        // Update variant's purchasePrice to latest unit cost & sync stock count
        await Product.updateOne(
          { _id: line.productId, 'variants._id': line.variantId },
          { $set: { 'variants.$.purchasePrice': line.unitCostPaise } },
          session ? { session } : {}
        );
      }

      if (session) {
        await purchase.save({ session });
      } else {
        await purchase.save();
      }

      // 7. Initial supplier payment
      if (initialPaidPaise > 0) {
        const payData = {
          supplierId,
          purchaseId: purchase._id,
          amountPaise: initialPaidPaise,
          mode: paymentMode,
          refNo,
          createdBy: userId,
        };
        if (session) {
          const [sp] = await SupplierPayment.create([payData], { session });
          createdPaymentId = sp._id;
        } else {
          const sp = await SupplierPayment.create(payData);
          createdPaymentId = sp._id;
        }
      }

      failpoint('purchase_inward_pre_commit');

      if (inTx && session) {
        await session.commitTransaction();
      }

      return purchase;
    } catch (err) {
      if (inTx && session) {
        try {
          await session.abortTransaction();
        } catch {}
      }

      // Check if another concurrent request with same idempotencyKey succeeded
      if (idempotencyKey) {
        for (let attempt = 0; attempt < 8; attempt++) {
          await new Promise((r) => setTimeout(r, 50));
          const existing = await Purchase.findOne({ idempotencyKey }).populate('supplierId', 'name phone gstin');
          if (existing) return existing;
        }
      }

      // Cleanup rollback tracker for non-replica or aborted operations
      try {
        if (createdPurchaseId) await Purchase.findByIdAndDelete(createdPurchaseId);
        if (createdProductIds.length > 0) await Product.deleteMany({ _id: { $in: createdProductIds } });
        for (const appVar of appendedVariantRefs) {
          await Product.updateOne({ _id: appVar.productId }, { $pull: { variants: { _id: appVar.variantId } } });
        }
        if (createdBatchIds.length > 0) await StockBatch.deleteMany({ _id: { $in: createdBatchIds } });
        if (createdMovementIds.length > 0) await StockMovement.deleteMany({ _id: { $in: createdMovementIds } });
        if (createdPaymentId) await SupplierPayment.findByIdAndDelete(createdPaymentId);
      } catch (cleanupErr) {
        // Ignore if disconnected
      }

      // Translate Mongo 11000 duplicate keys to standardized domain error codes
      if (err.code === 11000) {
        const keyPattern = err.keyPattern || err.keyValue || {};
        if (keyPattern.dupKey) {
          const customErr = new Error('Product with this brand and name already exists');
          customErr.code = 'PRODUCT_EXISTS';
          customErr.statusCode = 409;
          throw customErr;
        }
        if (keyPattern['variants.barcode']) {
          const customErr = new Error('Barcode already exists');
          customErr.code = 'BARCODE_EXISTS';
          customErr.statusCode = 409;
          throw customErr;
        }
        if (keyPattern['variants.sku']) {
          const customErr = new Error('SKU already exists');
          customErr.code = 'SKU_EXISTS';
          customErr.statusCode = 409;
          throw customErr;
        }
      }

      throw err;
    } finally {
      if (session) {
        session.endSession();
      }
    }
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
