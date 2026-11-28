import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';

import { Customer } from '../src/models/Customer.js';
import { CustomerLedger } from '../src/models/CustomerLedger.js';
import { Settings } from '../src/models/Settings.js';
import { Bill } from '../src/models/Bill.js';
import { User } from '../src/models/User.js';
import { Product } from '../src/models/Product.js';
import { StockBatch } from '../src/models/StockBatch.js';
import { billingService } from '../src/services/billing/billing.service.js';
import { dueService } from '../src/services/billing/due.service.js';

let mongod;
let cashier;
let staffToken;
let testProduct;
let testVariantId;
let testBatch;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  await Settings.create({
    state: 'Maharashtra',
    billPrefix: 'PS',
    defaultCustomerAddress: 'Visapur',
  });

  cashier = await User.create({
    name: 'Counter Cashier',
    phone: '9876543210',
    role: 'staff',
    password: 'Password@123',
  });

  const loginRes = await request(app).post('/api/auth/login').send({
    phone: '9876543210',
    password: 'Password@123',
  });
  staffToken = loginRes.headers['set-cookie'];

  testVariantId = new mongoose.Types.ObjectId();
  testProduct = await Product.create({
    name: 'Pro Whey Isolate',
    brand: 'MuscleBlaze',
    category: new mongoose.Types.ObjectId(),
    variants: [
      {
        _id: testVariantId,
        sku: 'MB-ISO-1KG',
        flavour: 'Chocolate',
        size: '1kg',
        mrp: 300000,
        sellingPrice: 250000,
        purchasePrice: 180000,
      },
    ],
  });

  testBatch = await StockBatch.create({
    productId: testProduct._id,
    variantId: testVariantId,
    batchNo: 'BAT-UDHARI-01',
    qtyReceived: 50,
    qtyLeft: 50,
    unitCostPaise: 180000,
    mrpPaise: 300000,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Unified Single-Process Billing & Udhari Flow Suite', () => {
  it('performs unified checkout with auto-created customer and partial payment (udhari)', async () => {
    const promiseDate = new Date();
    promiseDate.setDate(promiseDate.getDate() + 7);

    const payload = {
      items: [
        {
          productId: testProduct._id.toString(),
          variantId: testVariantId.toString(),
          qty: 1,
        },
      ],
      customerName: 'Sanjay Shinde',
      customerPhone: '9822334455',
      customerAddress: 'Visapur',
      payments: [
        {
          mode: 'cash',
          amountPaise: 100000, // Paid 1,000 of 2,500
        },
      ],
      dueDate: promiseDate.toISOString(),
    };

    const { bill } = await billingService.checkout(payload, cashier);

    expect(bill).toBeDefined();
    expect(bill.paidPaise).toBe(100000);
    expect(bill.duePaise).toBe(150000);
    expect(bill.dueDate).toBeDefined();
    expect(new Date(bill.dueDate).toISOString().slice(0, 10)).toBe(promiseDate.toISOString().slice(0, 10));

    // Verify Customer was created with village Visapur and due balance
    const customer = await Customer.findOne({ phone: '9822334455' });
    expect(customer).toBeDefined();
    expect(customer.name).toBe('Sanjay Shinde');
    expect(customer.address).toBe('Visapur');
    expect(customer.dueBalancePaise).toBe(150000);

    // Verify CustomerLedger record created with type bill_due
    const ledger = await CustomerLedger.find({ customerId: customer._id });
    expect(ledger.length).toBe(1);
    expect(ledger[0].type).toBe('bill_due');
    expect(ledger[0].amountPaise).toBe(150000);
  });

  it('calculates reminder stages (due_in_3_days, due_today, overdue)', async () => {
    // Create bill due in 3 days
    const in3Days = new Date();
    in3Days.setDate(in3Days.getDate() + 3);

    const customerA = await Customer.create({
      name: 'Ramesh Pawar',
      phone: '9811122233',
      address: 'Visapur',
      dueBalancePaise: 50000,
    });

    await Bill.create({
      billNo: 'PS/2627/990001',
      fy: '2627',
      status: 'completed',
      customerId: customerA._id,
      customerSnapshot: { name: customerA.name, phone: customerA.phone, address: 'Visapur' },
      staffId: cashier._id,
      staffNameSnapshot: cashier.name,
      items: [],
      subtotalPaise: 100000,
      taxablePaise: 100000,
      grandTotalPaise: 100000,
      paidPaise: 50000,
      duePaise: 50000,
      dueDate: in3Days,
      paymentSummary: [{ mode: 'cash', amountPaise: 50000 }],
    });

    // Create overdue bill (due 2 days ago)
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 2);

    const customerB = await Customer.create({
      name: 'Vijay Patil',
      phone: '9822233344',
      address: 'Visapur',
      dueBalancePaise: 80000,
    });

    await Bill.create({
      billNo: 'PS/2627/990002',
      fy: '2627',
      status: 'completed',
      customerId: customerB._id,
      customerSnapshot: { name: customerB.name, phone: customerB.phone, address: 'Visapur' },
      staffId: cashier._id,
      staffNameSnapshot: cashier.name,
      items: [],
      subtotalPaise: 80000,
      taxablePaise: 80000,
      grandTotalPaise: 80000,
      paidPaise: 0,
      duePaise: 80000,
      dueDate: overdueDate,
      paymentSummary: [],
    });

    const udhariResult = await dueService.getUdhariList({ filter: 'all' });

    expect(udhariResult.summary.totalOutstandingPaise).toBeGreaterThanOrEqual(130000);
    expect(udhariResult.summary.overdueCount).toBeGreaterThanOrEqual(1);

    const billA = udhariResult.bills.find((b) => b.billNo === 'PS/2627/990001');
    expect(billA).toBeDefined();
    expect(billA.stage).toBe('due_in_3_days');
    expect(billA.reminderMessage).toContain('Friendly reminder from Chava Fitness Club, Visapur');

    const billB = udhariResult.bills.find((b) => b.billNo === 'PS/2627/990002');
    expect(billB).toBeDefined();
    expect(billB.stage).toBe('overdue');
    expect(billB.reminderMessage).toContain('Important reminder from Chava Fitness Club, Visapur');
  });

  it('settles bill due completely, updates customer balance, and maintains bill history', async () => {
    const billToSettle = await Bill.findOne({ billNo: 'PS/2627/990001' });
    expect(billToSettle.duePaise).toBe(50000);

    const settleRes = await dueService.settleBillDue(
      {
        billId: billToSettle._id.toString(),
        mode: 'upi',
      },
      cashier
    );

    expect(settleRes.receiptNo).toBeDefined();
    expect(settleRes.bill.duePaise).toBe(0);
    expect(settleRes.customer.dueBalancePaise).toBe(0);

    // Verify updated bill in database
    const refreshedBill = await Bill.findById(billToSettle._id);
    expect(refreshedBill.duePaise).toBe(0);
    expect(refreshedBill.paidPaise).toBe(100000);
    expect(refreshedBill.status).toBe('completed'); // Remains in history
  });

  it('exposes HTTP endpoints for GET /api/billing/udhari and settle / remind', async () => {
    // 1. GET /api/billing/udhari
    const getRes = await request(app)
      .get('/api/billing/udhari')
      .set('Cookie', staffToken);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.bills).toBeDefined();
    expect(getRes.body.data.summary).toBeDefined();

    const overdueBill = getRes.body.data.bills.find((b) => b.stage === 'overdue');
    expect(overdueBill).toBeDefined();

    // 2. POST /api/billing/udhari/:billId/remind
    const remindRes = await request(app)
      .post(`/api/billing/udhari/${overdueBill._id}/remind`)
      .set('Cookie', staffToken)
      .send({ stage: 'overdue' });

    expect(remindRes.status).toBe(200);
    expect(remindRes.body.data.bill.lastReminderStage).toBe('overdue');

    // 3. POST /api/billing/udhari/:billId/settle
    const settleRes = await request(app)
      .post(`/api/billing/udhari/${overdueBill._id}/settle`)
      .set('Cookie', staffToken)
      .send({ mode: 'cash' });

    expect(settleRes.status).toBe(200);
    expect(settleRes.body.data.bill.duePaise).toBe(0);
    expect(settleRes.body.data.receiptNo).toBeDefined();
  });
});
