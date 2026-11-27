import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { Customer } from '../src/models/Customer.js';
import { StockBatch } from '../src/models/StockBatch.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { Bill } from '../src/models/Bill.js';
import { Payment } from '../src/models/Payment.js';

let mongod;
let ownerTokenCookie;
let staffTokenCookie;
let testProduct;
let testVariant;
let testCustomer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Create Owner & Staff
  await User.create({
    name: 'Owner User',
    phone: '9876543210',
    password: 'Password@123',
    role: 'owner',
    pin: '1234',
  });

  await User.create({
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

  // Create Category, Product & Variant
  const cat = await Category.create({ name: 'Creatine', description: 'Strength' });
  testProduct = await Product.create({
    name: 'Creapure Creatine',
    brand: 'MuscleBlaze',
    category: cat._id,
    hsn: '29362800',
    gstRate: 12,
    variants: [
      {
        flavour: 'Unflavoured',
        size: '250 g',
        sku: 'MB-CREA-250G',
        barcode: '8901234567890',
        mrp: 99900,
        sellingPrice: 89900,
        purchasePrice: 55000,
        minStockLevel: 5,
      },
    ],
  });
  testVariant = testProduct.variants[0];

  // Inward initial batch
  await StockBatch.create({
    productId: testProduct._id,
    variantId: testVariant._id,
    batchNo: 'BATCH-CREA-01',
    expiryDate: new Date('2028-12-31'),
    qtyReceived: 20,
    qtyLeft: 20,
    unitCostPaise: 55000,
  });

  testCustomer = await Customer.create({
    name: 'Suresh Patil',
    phone: '9811223344',
    state: 'Maharashtra',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 3: Billing POS, Taxes, FEFO Checkout & Invariants', () => {
  it('calculates real-time quote with inclusive GST, line discount, and roundoff', async () => {
    const res = await request(app)
      .post('/api/v1/billing/quote')
      .set('Cookie', ownerTokenCookie)
      .send({
        items: [
          {
            productId: testProduct._id,
            variantId: testVariant._id,
            qty: 2,
            lineDiscount: { type: 'pct', value: 10 }, // 10% line discount
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const quote = res.body.data.quote;
    expect(quote.lines).toHaveLength(1);
    expect(quote.subtotalPaise).toBe(179800); // 2 * 89900
    expect(quote.lineDiscountTotalPaise).toBe(17980); // 10% of 179800
    // Net = 179800 - 17980 = 161820
    expect(quote.rawGrandTotalPaise).toBe(161820);
    // Rounded to nearest ₹1: 161800
    expect(quote.roundOffPaise).toBe(-20);
    expect(quote.grandTotalPaise).toBe(161800);
    expect(quote.cgstPaise + quote.sgstPaise).toBe(quote.totalGstPaise);
  });

  it('completes atomic checkout, depletes stock via FEFO, and logs bill + payment', async () => {
    const idempotencyKey = 'test-idemp-' + Date.now();
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', ownerTokenCookie)
      .send({
        idempotencyKey,
        customerId: testCustomer._id,
        items: [
          {
            productId: testProduct._id,
            variantId: testVariant._id,
            qty: 3,
          },
        ],
        payments: [
          { mode: 'cash', amountPaise: 200000 },
          { mode: 'upi', amountPaise: 69700 }, // Total = 269700
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const bill = res.body.data.bill;
    expect(bill.billNo).toMatch(/^PS\/\d{4}\/\d{6}$/);
    expect(bill.grandTotalPaise).toBe(269700); // 3 * 89900 = 269700
    expect(bill.paidPaise).toBe(269700);
    expect(bill.duePaise).toBe(0);
    expect(bill.paymentSummary).toHaveLength(2);

    // Verify stock batch was decremented
    const batch = await StockBatch.findOne({ variantId: testVariant._id });
    expect(batch.qtyLeft).toBe(17); // 20 - 3 = 17

    // Verify StockMovement was recorded
    const movement = await StockMovement.findOne({ variantId: testVariant._id, type: 'sale' });
    expect(movement).toBeTruthy();
    expect(movement.qty).toBe(-3);
    expect(movement.balanceAfter).toBe(17);

    // Verify Payments were saved
    const payments = await Payment.find({ billId: bill._id });
    expect(payments).toHaveLength(2);

    // Idempotency: Repeating same checkout with same idempotencyKey returns existing bill
    const retryRes = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', ownerTokenCookie)
      .send({
        idempotencyKey,
        items: [{ productId: testProduct._id, variantId: testVariant._id, qty: 3 }],
        payments: [{ mode: 'cash', amountPaise: 269700 }],
      });

    expect(retryRes.status).toBe(201);
    expect(retryRes.body.data.duplicate).toBe(true);
    expect(retryRes.body.data.bill.billNo).toBe(bill.billNo);

    // Stock must NOT have decremented again
    const batchAfterRetry = await StockBatch.findOne({ variantId: testVariant._id });
    expect(batchAfterRetry.qtyLeft).toBe(17);
  });

  it('rejects checkout when requested quantity exceeds available inventory', async () => {
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', ownerTokenCookie)
      .send({
        items: [
          {
            productId: testProduct._id,
            variantId: testVariant._id,
            qty: 100, // Only 17 available
          },
        ],
        payments: [{ mode: 'cash', amountPaise: 8990000 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Insufficient stock');
  });

  it('enforces staff security and strips profitPaise and cost fields from staff responses', async () => {
    const res = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', staffTokenCookie)
      .send({
        items: [
          {
            productId: testProduct._id,
            variantId: testVariant._id,
            qty: 1,
          },
        ],
        payments: [{ mode: 'cash', amountPaise: 89900 }],
      });

    expect(res.status).toBe(201);
    const bill = res.body.data.bill;
    expect(bill.profitPaise).toBeUndefined();
    expect(bill.items[0].costTotalPaise).toBeUndefined();
    expect(bill.items[0].allocations[0].unitCostPaise).toBeUndefined();
  });
});
