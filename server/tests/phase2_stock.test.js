import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { Supplier } from '../src/models/Supplier.js';
import { StockBatch } from '../src/models/StockBatch.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { Purchase } from '../src/models/Purchase.js';
import { stockService } from '../src/services/stock.service.js';

let mongod;
let ownerTokenCookie;
let staffTokenCookie;
let testProduct;
let testVariant;
let testSupplier;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Create Owner & Staff
  const owner = await User.create({
    name: 'Owner User',
    phone: '9876543210',
    password: 'Password@123',
    role: 'owner',
    pin: '1234',
  });

  const staff = await User.create({
    name: 'Staff User',
    phone: '9876543211',
    password: 'Password@123',
    role: 'staff',
  });

  // Login Owner
  const ownerRes = await request(app).post('/api/auth/login').send({
    phone: '9876543210',
    password: 'Password@123',
  });
  ownerTokenCookie = ownerRes.headers['set-cookie'];

  // Login Staff
  const staffRes = await request(app).post('/api/auth/login').send({
    phone: '9876543211',
    password: 'Password@123',
  });
  staffTokenCookie = staffRes.headers['set-cookie'];

  // Create Category & Product
  const cat = await Category.create({ name: 'Protein', description: 'Proteins' });
  testProduct = await Product.create({
    name: '100% Gold Whey',
    brand: 'Optimum Nutrition',
    category: cat._id,
    hsn: '21069099',
    gstRate: 18,
    variants: [
      {
        flavour: 'Double Rich Chocolate',
        size: '2 lbs',
        sku: 'ON-WHEY-DRC-2LB',
        mrp: 350000,
        sellingPrice: 320000,
        purchasePrice: 240000,
        minStockLevel: 3,
      },
    ],
  });
  testVariant = testProduct.variants[0];

  testSupplier = await Supplier.create({
    name: 'Bright Commodities',
    phone: '9123456789',
    gstin: '27AABCB1234D1Z5',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 2: Stock, Purchases, Suppliers & FEFO Engine', () => {
  let createdPurchaseId;
  let createdBatchId;

  it('allows owner to inward a purchase with batch, expiry, and costs', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Cookie', ownerTokenCookie)
      .send({
        supplierId: testSupplier._id,
        supplierInvoiceNo: 'INV-2026-001',
        invoiceDate: '2026-04-15',
        paidPaise: 2500000,
        items: [
          {
            productId: testProduct._id,
            variantId: testVariant._id,
            qty: 10,
            unitCostPaise: 220000, // ₹2,200
            gstRate: 18,
            batchNo: 'BATCH-2026-A',
            expiryDate: '2027-06-01',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const purchase = res.body.data.purchase;
    expect(purchase.purchaseNo).toMatch(/^PU\/\d{4}\/\d{4}$/);
    expect(purchase.subtotalPaise).toBe(2200000); // 10 * 220000
    expect(purchase.gstPaise).toBe(396000); // 18% of 2200000
    expect(purchase.totalPaise).toBe(2596000);
    expect(purchase.duePaise).toBe(96000);
    expect(purchase.paymentStatus).toBe('partial');

    createdPurchaseId = purchase._id;

    // Verify StockBatch was created
    const batch = await StockBatch.findOne({ variantId: testVariant._id, batchNo: 'BATCH-2026-A' });
    expect(batch).toBeTruthy();
    expect(batch.qtyReceived).toBe(10);
    expect(batch.qtyLeft).toBe(10);
    expect(batch.unitCostPaise).toBe(220000);
    createdBatchId = batch._id;

    // Verify immutable StockMovement was recorded
    const movement = await StockMovement.findOne({ batchId: batch._id, type: 'purchase' });
    expect(movement).toBeTruthy();
    expect(movement.qty).toBe(10);
    expect(movement.balanceAfter).toBe(10);

    // Verify variant purchasePrice was updated
    const updatedProd = await Product.findById(testProduct._id);
    expect(updatedProd.variants[0].purchasePrice).toBe(220000);
  });

  it('allocates batches using FEFO (First-Expiry, First-Out)', async () => {
    // Add a second batch with EARLIER expiry (but not expired: Jan 2027 vs June 2027)
    const earlierBatch = await StockBatch.create({
      productId: testProduct._id,
      variantId: testVariant._id,
      batchNo: 'BATCH-EARLY',
      expiryDate: new Date('2027-01-01'), // expires sooner than 2027-06
      qtyReceived: 5,
      qtyLeft: 5,
      unitCostPaise: 210000,
    });

    const allocations = await stockService.allocateBatches(testVariant._id, 7);
    expect(allocations).toHaveLength(2);
    // First allocation must be the earlier expiring batch
    expect(allocations[0].batchNo).toBe('BATCH-EARLY');
    expect(allocations[0].qty).toBe(5);
    // Second allocation consumes 2 from the later batch
    expect(allocations[1].batchNo).toBe('BATCH-2026-A');
    expect(allocations[1].qty).toBe(2);
  });

  it('allows owner to adjust stock with non-negative guard', async () => {
    // Decrease 2 units due to damage
    const res = await request(app)
      .post('/api/v1/stock/adjustments')
      .set('Cookie', ownerTokenCookie)
      .send({
        batchId: createdBatchId,
        qty: 2,
        direction: 'decrease',
        reason: 'damaged',
        notes: 'Dented tub during shelf stacking',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const batch = await StockBatch.findById(createdBatchId);
    expect(batch.qtyLeft).toBe(8); // 10 - 2

    const movement = await StockMovement.findOne({ batchId: createdBatchId, type: 'adjustment' });
    expect(movement.qty).toBe(-2);
    expect(movement.balanceAfter).toBe(8);

    // Attempting to decrease more than remaining should fail
    const failRes = await request(app)
      .post('/api/v1/stock/adjustments')
      .set('Cookie', ownerTokenCookie)
      .send({
        batchId: createdBatchId,
        qty: 20,
        direction: 'decrease',
        reason: 'counting_correction',
      });

    expect(failRes.status).toBe(500); // business rule error caught by error handler
  });

  it('blocks purchase void when any stock has been consumed/adjusted', async () => {
    const res = await request(app)
      .post(`/api/v1/purchases/${createdPurchaseId}/void`)
      .set('Cookie', ownerTokenCookie)
      .send({ reason: 'Accidental duplicate entry' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('already been sold or adjusted');
  });

  it('enforces staff role security and data redaction', async () => {
    // 1. Staff is forbidden from accessing purchases
    const purchasesRes = await request(app)
      .get('/api/v1/purchases')
      .set('Cookie', staffTokenCookie);
    expect(purchasesRes.status).toBe(403);

    // 2. Staff is forbidden from accessing suppliers
    const suppliersRes = await request(app)
      .get('/api/v1/suppliers')
      .set('Cookie', staffTokenCookie);
    expect(suppliersRes.status).toBe(403);

    // 3. Staff can view stock list, but costs and stock values must be undefined
    const stockRes = await request(app)
      .get('/api/v1/stock')
      .set('Cookie', staffTokenCookie);
    expect(stockRes.status).toBe(200);
    const item = stockRes.body.data.items[0];
    expect(item).toBeTruthy();
    expect(item.stock).toBeGreaterThan(0);
    expect(item.unitCostPaise).toBeUndefined();
    expect(item.purchasePrice).toBeUndefined();
    expect(item.stockValuePaise).toBeUndefined();
    expect(stockRes.body.data.stats.totalStockValuePaise).toBeUndefined();
  });
});
