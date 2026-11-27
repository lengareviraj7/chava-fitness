import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Customer } from '../src/models/Customer.js';
import { Settings } from '../src/models/Settings.js';
import { Bill } from '../src/models/Bill.js';
import { User } from '../src/models/User.js';
import { Product } from '../src/models/Product.js';
import { StockBatch } from '../src/models/StockBatch.js';
import { customerService, normalizeCustomerPhone, normalizeCustomerName } from '../src/services/customer.service.js';
import { billingService } from '../src/services/billing/billing.service.js';
import { runMigration } from '../scripts/migrate-customer-address.js';

let mongod;
let staffUser;
let testProduct;
let testVariantId;
let testBatch;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  staffUser = await User.create({
    name: 'Counter Cashier',
    phone: '9876543210',
    role: 'staff',
    password: 'Password@123',
  });

  testVariantId = new mongoose.Types.ObjectId();
  testProduct = await Product.create({
    name: '100% Whey Gold',
    brand: 'Optimum Nutrition',
    category: new mongoose.Types.ObjectId(),
    variants: [
      {
        _id: testVariantId,
        sku: 'ON-WHEY-1KG',
        flavour: 'Double Rich Chocolate',
        size: '1kg',
        mrp: 350000,
        sellingPrice: 320000,
        purchasePrice: 250000,
      },
    ],
  });

  testBatch = await StockBatch.create({
    productId: testProduct._id,
    variantId: testVariantId,
    batchNo: 'B-QA-001',
    qtyReceived: 50,
    qtyLeft: 50,
    unitCostPaise: 250000,
    expiryDate: new Date('2028-12-31'),
  });

  await Settings.create({
    shopName: 'Chava Fitness Club',
    state: 'Maharashtra',
    defaultCustomerAddress: 'Visapur',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Customer Quick-Add: Normalization & Validation', () => {
  it('normalizes Devanagari numerals to ASCII and cleans prefixes', () => {
    expect(normalizeCustomerPhone('९८७६५४३२१०')).toBe('9876543210');
    expect(normalizeCustomerPhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizeCustomerPhone('098765-43210')).toBe('9876543210');
    expect(normalizeCustomerPhone(' +91-98765-43210 ')).toBe('9876543210');
  });

  it('normalizes customer names and collapses whitespace', () => {
    expect(normalizeCustomerName('  Ramesh   Patil  ')).toBe('Ramesh Patil');
    expect(normalizeCustomerName('विक्रम   शिंदे')).toBe('विक्रम शिंदे');
  });

  it('rejects invalid mobile numbers with CUSTOMER_PHONE_INVALID', async () => {
    await expect(
      customerService.create({ name: 'Rahul Shinde', phone: '12345' })
    ).rejects.toMatchObject({
      code: 'CUSTOMER_PHONE_INVALID',
      statusCode: 400,
    });

    await expect(
      customerService.create({ name: 'Rahul Shinde', phone: '5555555555' }) // must start with 6-9
    ).rejects.toMatchObject({
      code: 'CUSTOMER_PHONE_INVALID',
      statusCode: 400,
    });
  });

  it('rejects invalid names with CUSTOMER_NAME_INVALID', async () => {
    await expect(
      customerService.create({ name: 'A', phone: '9822112233' })
    ).rejects.toMatchObject({
      code: 'CUSTOMER_NAME_INVALID',
      statusCode: 400,
    });
  });
});

describe('Customer Quick-Add: Creation & Duplicate 409 Conflict', () => {
  let createdCustomer;

  it('successfully creates customer with pre-filled address and Devanagari phone', async () => {
    createdCustomer = await customerService.create({
      name: '  Suresh   Patil  ',
      phone: '९८२२३३४४५५',
      address: 'Visapur',
    });

    expect(createdCustomer.name).toBe('Suresh Patil');
    expect(createdCustomer.phone).toBe('9822334455');
    expect(createdCustomer.address).toBe('Visapur');
  });

  it('returns HTTP 409 CUSTOMER_PHONE_EXISTS with existing customer summary when duplicate is submitted', async () => {
    try {
      await customerService.create({
        name: 'Suresh Patil Duplicate',
        phone: '+91 98223-34455',
        address: 'Pune',
      });
      expect.fail('Should have thrown 409 conflict error');
    } catch (err) {
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CUSTOMER_PHONE_EXISTS');
      expect(err.existingCustomer).toBeDefined();
      expect(err.existingCustomer.name).toBe('Suresh Patil');
      expect(err.existingCustomer.phone).toBe('9822334455');
      expect(err.existingCustomer.address).toBe('Visapur');
    }
  });
});

describe('Customer Fast Lookup (Data Leakage Guard)', () => {
  beforeAll(async () => {
    await Customer.create([
      { name: 'Kiran More', phone: '9811223344', address: 'Visapur', dueBalancePaise: 50000 },
      { name: 'Kiran Kadam', phone: '9811223355', address: 'Tasgaon', dueBalancePaise: 0 },
      { name: 'Mahesh Patil', phone: '9899887766', address: 'Sangli', dueBalancePaise: 25000 },
    ]);
  });

  it('searches by name (2+ characters) and returns max 8 stripped results without leaking internals', async () => {
    const results = await customerService.lookup('Kir');
    expect(results.length).toBe(2);

    for (const r of results) {
      expect(r._id).toBeDefined();
      expect(r.name).toBeDefined();
      expect(r.phone).toBeDefined();
      expect(r.address).toBeDefined();
      expect(r.dueBalancePaise).toBeDefined();
      // Internal fields must NOT be returned
      expect(r.gstin).toBeUndefined();
      expect(r.state).toBeUndefined();
      expect(r.openingDuePaise).toBeUndefined();
      expect(r.createdAt).toBeUndefined();
    }
  });

  it('searches by phone digits (3+ digits, accepts Devanagari numerals)', async () => {
    const results = await customerService.lookup('९८९९'); // 9899
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Mahesh Patil');
    expect(results[0].phone).toBe('9899887766');
  });

  it('returns empty array when query is too short', async () => {
    const results = await customerService.lookup('K');
    expect(results).toEqual([]);
  });
});

describe('Billing Checkout Snapshot Retention', () => {
  it('snapshots customer address onto the bill at checkout', async () => {
    const customer = await Customer.findOne({ phone: '9822334455' });

    const { bill } = await billingService.checkout(
      {
        customerId: customer._id,
        items: [
          {
            productId: testProduct._id,
            variantId: testVariantId,
            qty: 1,
            unitPricePaise: 320000,
          },
        ],
        payments: [{ mode: 'cash', amountPaise: 320000, cashTenderedPaise: 320000 }],
      },
      staffUser
    );

    expect(bill.customerSnapshot).toBeDefined();
    expect(bill.customerSnapshot.name).toBe('Suresh Patil');
    expect(bill.customerSnapshot.phone).toBe('9822334455');
    expect(bill.customerSnapshot.address).toBe('Visapur');
  });
});

describe('Idempotent Migration Script', () => {
  it('verifies runMigration preserves settings and existing customers', async () => {
    const res = await runMigration();
    expect(res.success).toBe(true);
    expect(res.defaultCustomerAddress).toBe('Visapur');
  });
});
