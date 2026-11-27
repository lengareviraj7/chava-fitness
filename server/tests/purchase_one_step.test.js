import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Supplier } from '../src/models/Supplier.js';
import { Product } from '../src/models/Product.js';
import { StockBatch } from '../src/models/StockBatch.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { Purchase } from '../src/models/Purchase.js';
import { Counter } from '../src/models/Counter.js';
import { purchaseService } from '../src/services/purchase.service.js';
import { productService } from '../src/services/product.service.js';
import { normalizeDupKey } from '../src/utils/dupKey.js';
import { generateSku } from '../src/utils/sku.js';
import { failpoint, setFailpoint, clearFailpoint } from '../src/utils/failpoint.js';

let mongod;
let ownerUser;
let staffUser;
let testCategory;
let testSupplier;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  ownerUser = await User.create({
    name: 'Chava Owner',
    phone: '9876543210',
    role: 'owner',
    password: 'Password@123',
    pin: '1234',
  });

  staffUser = await User.create({
    name: 'Chava Staff',
    phone: '9876543211',
    role: 'staff',
    password: 'Password@123',
  });

  testCategory = await Category.create({
    name: 'Proteins',
  });

  testSupplier = await Supplier.create({
    name: 'Muscle Tech Distributors',
    phone: '9811223344',
    gstin: '27AABCU9603R1ZM',
  });

  await Product.init();
  await Purchase.init();
  await StockBatch.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => {
  clearFailpoint();
});

describe('One-Step Purchase & Inward Stock Test Suite', () => {
  describe('1. DupKey Normalization & SKU Generation', () => {
    it('normalizes brand, name and categoryId accurately', () => {
      const key1 = normalizeDupKey('MuscleBlaze', 'Whey Protein Isolate', testCategory._id);
      const key2 = normalizeDupKey(' muscleblaze! ', 'whey   protein isolate.', testCategory._id.toString());
      expect(key1).toBe(key2);
      expect(key1).toContain('muscleblaze|whey protein isolate');
    });

    it('generates deterministic uppercase SKUs', () => {
      const sku = generateSku({
        brand: 'MuscleBlaze',
        name: 'Whey Protein',
        flavour: 'Chocolate',
        size: '1 kg',
      });
      expect(sku).toBe('MB-WP-CHO-1KG');
    });
  });

  describe('2. Unified One-Step Product Creation & Stock Inward', () => {
    it('creates new product, variants, and inward stock in a single purchase', async () => {
      const payload = {
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-ONE-001',
        invoiceDate: '2026-11-27',
        idempotencyKey: 'idem-one-step-001',
        newProducts: [
          {
            tempId: 'temp_prod_1',
            name: 'Biozyme Performance Whey',
            brand: 'MuscleBlaze',
            categoryId: testCategory._id,
            hsn: '21069099',
            gstRate: 18,
            trackExpiry: true,
            lowStockLimit: 4,
            variants: [
              {
                tempId: 'temp_var_1',
                flavour: 'Rich Chocolate',
                size: '1 kg',
                barcode: '8901234567890',
                mrpPaise: 349900,
                sellingPricePaise: 299900,
              },
              {
                tempId: 'temp_var_2',
                flavour: 'Cafe Mocha',
                size: '1 kg',
                barcode: '8901234567891',
                mrpPaise: 349900,
                sellingPricePaise: 299900,
              },
            ],
          },
        ],
        items: [
          {
            tempVariantId: 'temp_var_1',
            qty: 12,
            unitCostPaise: 210000,
            batchNo: 'MB-BZW-01',
            expiryMonth: '12/2028',
          },
          {
            tempVariantId: 'temp_var_2',
            qty: 8,
            unitCostPaise: 210000,
            batchNo: 'MB-BZW-02',
            expiryMonth: '12/2028',
          },
        ],
        paidPaise: 4200000,
        paymentMode: 'bank',
        refNo: 'IMPS-998811',
      };

      const purchase = await purchaseService.createPurchase(payload, ownerUser._id);
      expect(purchase).toBeDefined();
      expect(purchase.purchaseNo).toMatch(/^PU\/2627\/\d{4}$/);
      expect(purchase.items).toHaveLength(2);

      // Verify product was created
      const createdProd = await Product.findOne({ name: 'Biozyme Performance Whey' });
      expect(createdProd).not.toBeNull();
      expect(createdProd.variants).toHaveLength(2);
      expect(createdProd.dupKey).toBe(normalizeDupKey('MuscleBlaze', 'Biozyme Performance Whey', testCategory._id));

      // Verify stock batches created with last day of month
      const batch1 = await StockBatch.findOne({ batchNo: 'MB-BZW-01' });
      expect(batch1).not.toBeNull();
      expect(batch1.qtyReceived).toBe(12);
      expect(batch1.qtyLeft).toBe(12);
      expect(batch1.unitCostPaise).toBe(210000);
      expect(batch1.expiryDate.toISOString()).toContain('2028-12-31');

      // Verify stock movements
      const movements = await StockMovement.find({ refId: purchase._id });
      expect(movements).toHaveLength(2);
      expect(movements[0].type).toBe('purchase');
    });

    it('creates new variant on an EXISTING product inside purchase', async () => {
      const existingProd = await Product.findOne({ name: 'Biozyme Performance Whey' });
      expect(existingProd).not.toBeNull();

      const payload = {
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-NEW-VAR-002',
        invoiceDate: '2026-11-27',
        idempotencyKey: 'idem-new-var-002',
        newVariants: [
          {
            tempId: 'temp_var_3',
            productId: existingProd._id,
            flavour: 'Vanilla',
            size: '2 kg',
            barcode: '8901234567892',
            mrpPaise: 649900,
            sellingPricePaise: 549900,
          },
        ],
        items: [
          {
            tempVariantId: 'temp_var_3',
            qty: 6,
            unitCostPaise: 380000,
            batchNo: 'MB-BZW-VAN-2K',
            expiryMonth: '06/2028',
          },
        ],
      };

      const purchase = await purchaseService.createPurchase(payload, ownerUser._id);
      expect(purchase).toBeDefined();

      const reloadedProd = await Product.findById(existingProd._id);
      expect(reloadedProd.variants).toHaveLength(3);
      const vanillaVar = reloadedProd.variants.find((v) => v.flavour === 'Vanilla');
      expect(vanillaVar).toBeDefined();
      expect(vanillaVar.purchasePrice).toBe(380000);
    });
  });

  describe('3. Atomicity & Failpoint Verification', () => {
    it('aborts entire transaction if failpoint triggers during stock batch creation', async () => {
      const initialProductCount = await Product.countDocuments();
      const initialBatchCount = await StockBatch.countDocuments();
      const initialPurchaseCount = await Purchase.countDocuments();

      setFailpoint('purchase_inward_batch_create');

      const payload = {
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-FAIL-001',
        invoiceDate: '2026-11-27',
        newProducts: [
          {
            tempId: 'temp_fail_prod',
            name: 'Atomic Test Isolate',
            brand: 'Dymatize',
            categoryId: testCategory._id,
            gstRate: 18,
            variants: [
              {
                tempId: 'temp_fail_var',
                flavour: 'Gourmet Chocolate',
                size: '2 lbs',
                mrpPaise: 399900,
                sellingPricePaise: 349900,
              },
            ],
          },
        ],
        items: [
          {
            tempVariantId: 'temp_fail_var',
            qty: 5,
            unitCostPaise: 240000,
            batchNo: 'FAIL-BATCH-1',
            expiryMonth: '11/2028',
          },
        ],
      };

      await expect(purchaseService.createPurchase(payload, ownerUser._id)).rejects.toThrow();

      // Verify ZERO records created
      expect(await Product.countDocuments()).toBe(initialProductCount);
      expect(await StockBatch.countDocuments()).toBe(initialBatchCount);
      expect(await Purchase.countDocuments()).toBe(initialPurchaseCount);
    });
  });

  describe('4. Duplicate & Validation Rules', () => {
    it('rejects duplicate brand + product name with PRODUCT_EXISTS', async () => {
      const payload = {
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-DUP-001',
        newProducts: [
          {
            tempId: 'temp_dup',
            name: 'Biozyme Performance Whey', // Already exists!
            brand: 'MuscleBlaze',
            categoryId: testCategory._id,
            gstRate: 18,
            variants: [
              {
                tempId: 'temp_dup_var',
                flavour: 'Cookie & Cream',
                size: '1 kg',
                mrpPaise: 349900,
                sellingPricePaise: 299900,
              },
            ],
          },
        ],
        items: [
          {
            tempVariantId: 'temp_dup_var',
            qty: 5,
            unitCostPaise: 210000,
            batchNo: 'B-DUP-1',
            expiryMonth: '12/2028',
          },
        ],
      };

      await expect(purchaseService.createPurchase(payload, ownerUser._id)).rejects.toMatchObject({
        code: 'PRODUCT_EXISTS',
      });
    });

    it('rejects duplicate barcode with BARCODE_EXISTS', async () => {
      const payload = {
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-BARCODE-DUP',
        newProducts: [
          {
            tempId: 'temp_bar_prod',
            name: 'Raw Whey 80%',
            brand: 'Asitis',
            categoryId: testCategory._id,
            gstRate: 0,
            variants: [
              {
                tempId: 'temp_bar_var',
                flavour: 'Unflavoured',
                size: '1 kg',
                barcode: '8901234567890', // Already used on Biozyme Rich Chocolate
                mrpPaise: 199900,
                sellingPricePaise: 169900,
              },
            ],
          },
        ],
        items: [
          {
            tempVariantId: 'temp_bar_var',
            qty: 10,
            unitCostPaise: 110000,
            batchNo: 'AS-RAW-1',
            expiryMonth: '12/2028',
          },
        ],
      };

      await expect(purchaseService.createPurchase(payload, ownerUser._id)).rejects.toMatchObject({
        code: 'BARCODE_EXISTS',
      });
    });

    it('rejects selling price above MRP with SELLING_PRICE_ABOVE_MRP', async () => {
      const payload = {
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-MRP-ERR',
        newProducts: [
          {
            tempId: 'temp_mrp_prod',
            name: 'Nitrotech Ripped',
            brand: 'MuscleTech',
            categoryId: testCategory._id,
            gstRate: 18,
            variants: [
              {
                tempId: 'temp_mrp_var',
                flavour: 'Chocolate Fudge',
                size: '4 lbs',
                mrpPaise: 400000,
                sellingPricePaise: 450000, // Above MRP!
              },
            ],
          },
        ],
        items: [
          {
            tempVariantId: 'temp_mrp_var',
            qty: 4,
            unitCostPaise: 280000,
            batchNo: 'MT-RIP-01',
            expiryMonth: '10/2028',
          },
        ],
      };

      await expect(purchaseService.createPurchase(payload, ownerUser._id)).rejects.toMatchObject({
        code: 'SELLING_PRICE_ABOVE_MRP',
      });
    });

    it('rejects past expiry with EXPIRY_IN_PAST', async () => {
      const payload = {
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-EXP-ERR',
        newProducts: [
          {
            tempId: 'temp_exp_prod',
            name: 'Gold Standard Casein',
            brand: 'Optimum Nutrition',
            categoryId: testCategory._id,
            gstRate: 18,
            variants: [
              {
                tempId: 'temp_exp_var',
                flavour: 'Chocolate Supreme',
                size: '2 lbs',
                mrpPaise: 389900,
                sellingPricePaise: 339900,
              },
            ],
          },
        ],
        items: [
          {
            tempVariantId: 'temp_exp_var',
            qty: 2,
            unitCostPaise: 240000,
            batchNo: 'ON-CAS-PAST',
            expiryMonth: '07/2020', // Past!
          },
        ],
      };

      await expect(purchaseService.createPurchase(payload, ownerUser._id)).rejects.toMatchObject({
        code: 'EXPIRY_IN_PAST',
      });
    });

    it('rejects missing GST rate for new product with GST_RATE_REQUIRED', async () => {
      const payload = {
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-NOGST',
        newProducts: [
          {
            tempId: 'temp_nogst_prod',
            name: 'Creatine Monohydrate 250g',
            brand: 'GNC',
            categoryId: testCategory._id,
            // gstRate omitted!
            variants: [
              {
                tempId: 'temp_nogst_var',
                flavour: 'Unflavoured',
                size: '250 g',
                mrpPaise: 99900,
                sellingPricePaise: 79900,
              },
            ],
          },
        ],
        items: [
          {
            tempVariantId: 'temp_nogst_var',
            qty: 5,
            unitCostPaise: 50000,
            batchNo: 'GNC-CR-1',
            expiryMonth: '12/2028',
          },
        ],
      };

      await expect(purchaseService.createPurchase(payload, ownerUser._id)).rejects.toMatchObject({
        code: 'GST_RATE_REQUIRED',
      });
    });
  });

  describe('5. Concurrency & Idempotency', () => {
    it('creates exactly 1 purchase and 1 product set when replayed 10 times concurrently', async () => {
      const payload = {
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-CONCUR-001',
        invoiceDate: '2026-11-27',
        idempotencyKey: 'idem-concurrency-test-999',
        newProducts: [
          {
            tempId: 'temp_conc_prod',
            name: 'Hydrolyzed ISO Zero',
            brand: 'Dymatize',
            categoryId: testCategory._id,
            gstRate: 18,
            variants: [
              {
                tempId: 'temp_conc_var',
                flavour: 'Birthday Cake',
                size: '1.6 lbs',
                barcode: '8909988776655',
                mrpPaise: 429900,
                sellingPricePaise: 389900,
              },
            ],
          },
        ],
        items: [
          {
            tempVariantId: 'temp_conc_var',
            qty: 5,
            unitCostPaise: 270000,
            batchNo: 'DYM-ISO-99',
            expiryMonth: '09/2028',
          },
        ],
      };

      const results = await Promise.all(
        Array.from({ length: 10 }).map(() => purchaseService.createPurchase(payload, ownerUser._id))
      );

      // All returned purchases must have identical _id and purchaseNo
      const firstId = results[0]._id.toString();
      for (const res of results) {
        expect(res._id.toString()).toBe(firstId);
      }

      const matchingProducts = await Product.find({ name: 'Hydrolyzed ISO Zero' });
      expect(matchingProducts).toHaveLength(1);
    });
  });

  describe('6. Similar Products API & Access Control', () => {
    it('returns similar products for owner query with exact and fuzzy matching', async () => {
      const similar = await productService.findSimilar({
        brand: 'MuscleBlaze',
        name: 'Biozyme Performance',
        categoryId: testCategory._id,
      });

      expect(similar.length).toBeGreaterThan(0);
      const match = similar[0];
      expect(match.name).toContain('Biozyme');
      expect(match.variants).toBeDefined();
    });
  });
});
