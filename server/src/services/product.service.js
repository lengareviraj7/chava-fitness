import { Category } from '../models/Category.js';
import { Brand } from '../models/Brand.js';
import { Product } from '../models/Product.js';
import { StockBatch } from '../models/StockBatch.js';
import { normalizeDupKey } from '../utils/dupKey.js';

export const sanitizeProductForUser = (productDoc, userRole) => {
  const prod = productDoc.toObject ? productDoc.toObject() : JSON.parse(JSON.stringify(productDoc));
  
  if (userRole !== 'owner') {
    if (Array.isArray(prod.variants)) {
      prod.variants = prod.variants.map((v) => {
        const { purchasePrice, ...rest } = v;
        return rest;
      });
    }
  }
  return prod;
};

export const productService = {
  async list({ category, brand, search, stockStatus, isActive, page = 1, limit = 50, userRole = 'staff' }) {
    const query = {};

    if (isActive !== undefined && isActive !== 'all') {
      query.isActive = isActive === 'true' || isActive === true;
    }

    if (category) {
      query.category = category;
    }

    if (brand) {
      query.brand = brand;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { brand: regex },
        { 'variants.sku': regex },
        { 'variants.barcode': regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(query),
    ]);

    // Enrich variants with real-time StockBatch total
    for (const p of products) {
      if (Array.isArray(p.variants)) {
        for (const v of p.variants) {
          const batches = await StockBatch.find({ variantId: v._id, qtyLeft: { $gt: 0 } });
          v.stock = batches.reduce((sum, b) => sum + (b.qtyLeft || 0), 0);
        }
      }
    }

    // Apply stockStatus filter in memory if specified
    let filtered = products.map((p) => sanitizeProductForUser(p, userRole));

    if (stockStatus && stockStatus !== 'all') {
      filtered = filtered.filter((p) => {
        const totalStock = (p.variants || []).reduce((sum, v) => sum + (v.stock || 0), 0);
        if (stockStatus === 'in_stock') return totalStock > 0;
        if (stockStatus === 'low_stock') {
          return (p.variants || []).some((v) => (v.stock || 0) <= (v.minStockLevel || 5));
        }
        if (stockStatus === 'out_of_stock') return totalStock === 0;
        return true;
      });
    }

    return {
      products: filtered,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    };
  },

  async getById(id, userRole = 'staff') {
    const product = await Product.findById(id).populate('category', 'name');
    if (!product) return null;
    if (Array.isArray(product.variants)) {
      for (const v of product.variants) {
        const batches = await StockBatch.find({ variantId: v._id, qtyLeft: { $gt: 0 } });
        v.stock = batches.reduce((sum, b) => sum + (b.qtyLeft || 0), 0);
      }
    }
    return sanitizeProductForUser(product, userRole);
  },

  async create(data) {
    // Validate variants
    if (!data.variants || !Array.isArray(data.variants) || data.variants.length === 0) {
      throw new Error('A product must contain at least one variant.');
    }

    // Auto sync brand if new
    if (data.brand) {
      await Brand.findOneAndUpdate(
        { name: data.brand.trim() },
        { name: data.brand.trim() },
        { upsert: true, new: true }
      );
    }

    // Check variant sellingPrice <= mrp
    for (const v of data.variants) {
      if (v.sellingPrice > v.mrp) {
        throw new Error(`Variant ${v.flavour} (${v.size}) selling price cannot exceed MRP.`);
      }
    }

    const product = await Product.create(data);

    // Sync initial stock into StockBatch so POS and inventory reflect it immediately
    for (const v of product.variants) {
      const stockQty = Number(v.stock) || 0;
      if (stockQty > 0) {
        await StockBatch.create({
          productId: product._id,
          variantId: v._id,
          batchNo: 'OPENING',
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          qtyReceived: stockQty,
          qtyLeft: stockQty,
          unitCostPaise: v.purchasePrice || 0,
        });
      }
    }

    return product.populate('category', 'name');
  },

  async update(id, data) {
    if (data.variants && Array.isArray(data.variants)) {
      for (const v of data.variants) {
        if (v.sellingPrice > v.mrp) {
          throw new Error(`Variant ${v.flavour} (${v.size}) selling price cannot exceed MRP.`);
        }
      }
    }

    if (data.brand) {
      await Brand.findOneAndUpdate(
        { name: data.brand.trim() },
        { name: data.brand.trim() },
        { upsert: true, new: true }
      );
    }

    const updated = await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('category', 'name');

    // Sync variant stock to StockBatch
    if (updated && Array.isArray(updated.variants)) {
      for (const v of updated.variants) {
        const targetStock = Number(v.stock) || 0;
        const existingBatches = await StockBatch.find({ variantId: v._id });
        const batchTotal = existingBatches.reduce((sum, b) => sum + (b.qtyLeft || 0), 0);

        if (existingBatches.length === 0 && targetStock > 0) {
          await StockBatch.create({
            productId: updated._id,
            variantId: v._id,
            batchNo: 'OPENING',
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            qtyReceived: targetStock,
            qtyLeft: targetStock,
            unitCostPaise: v.purchasePrice || 0,
          });
        } else if (existingBatches.length > 0 && targetStock !== batchTotal) {
          const diff = targetStock - batchTotal;
          const primaryBatch = existingBatches[0];
          const newQtyLeft = Math.max(0, (primaryBatch.qtyLeft || 0) + diff);
          await StockBatch.findByIdAndUpdate(primaryBatch._id, {
            qtyLeft: newQtyLeft,
            qtyReceived: Math.max(primaryBatch.qtyReceived || 0, newQtyLeft),
          });
        }
      }
    }

    return updated;
  },

  async toggleActive(id) {
    const product = await Product.findById(id);
    if (!product) return null;
    product.isActive = !product.isActive;
    await product.save();
    return product;
  },

  async delete(id) {
    // Soft delete
    return Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
  },

  async findSimilar({ name = '', brand = '', categoryId = '' }) {
    if (!name?.trim() && !brand?.trim()) return [];

    const clean = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    const cleanName = clean(name);
    const cleanBrand = clean(brand);

    // Exact dupKey check
    const exactDupKey = normalizeDupKey(brand, name, categoryId);
    const exactProduct = await Product.findOne({ dupKey: exactDupKey, isActive: true })
      .populate('category', 'name')
      .lean();

    // Query candidates matching brand words or name words
    const queryParts = [];
    if (cleanName) {
      const words = cleanName.split(/\s+/).filter((w) => w.length > 2);
      if (words.length > 0) {
        queryParts.push({ name: { $regex: words.join('|'), $options: 'i' } });
      }
    }
    if (cleanBrand) {
      queryParts.push({ brand: { $regex: cleanBrand, $options: 'i' } });
    }

    const filter = { isActive: true };
    if (queryParts.length > 0) {
      filter.$or = queryParts;
    }
    if (categoryId) {
      filter.category = categoryId;
    }

    const candidates = await Product.find(filter)
      .populate('category', 'name')
      .limit(20)
      .lean();

    // Score candidates
    const results = [];
    const seenIds = new Set();

    if (exactProduct) {
      results.push({
        _id: exactProduct._id,
        name: exactProduct.name,
        brand: exactProduct.brand,
        category: exactProduct.category,
        dupKey: exactProduct.dupKey,
        isExactMatch: true,
        variants: (exactProduct.variants || []).map((v) => ({
          _id: v._id,
          flavour: v.flavour,
          size: v.size,
          sku: v.sku,
          mrp: v.mrp,
          sellingPrice: v.sellingPrice,
        })),
      });
      seenIds.add(exactProduct._id.toString());
    }

    for (const p of candidates) {
      if (seenIds.has(p._id.toString())) continue;
      const isExact = p.dupKey === exactDupKey;
      results.push({
        _id: p._id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        dupKey: p.dupKey,
        isExactMatch: isExact,
        variants: (p.variants || []).map((v) => ({
          _id: v._id,
          flavour: v.flavour,
          size: v.size,
          sku: v.sku,
          mrp: v.mrp,
          sellingPrice: v.sellingPrice,
        })),
      });
      seenIds.add(p._id.toString());
      if (results.length >= 5) break;
    }

    return results;
  },
};
