import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';

import { User } from '../src/models/User.js';
import { Customer } from '../src/models/Customer.js';
import { CustomerLedger } from '../src/models/CustomerLedger.js';
import { Product } from '../src/models/Product.js';
import { StockBatch } from '../src/models/StockBatch.js';
import { Bill } from '../src/models/Bill.js';
import { CreditNote } from '../src/models/CreditNote.js';
import { Payment } from '../src/models/Payment.js';
import { DayClose } from '../src/models/DayClose.js';
import { CashEntry } from '../src/models/CashEntry.js';
import { customerService } from '../src/services/customer.service.js';
import { dueService } from '../src/services/billing/due.service.js';
import { returnService } from '../src/services/billing/return.service.js';
import { dayCloseService } from '../src/services/billing/dayClose.service.js';

let mongod;
let ownerUser;
let staffUser;
let testProduct;
let testVariantId;
let testBatch;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  ownerUser = await User.create({
    name: 'Owner User',
    phone: '9876543210',
    role: 'owner',
    password: 'Secret@123',
    pin: '1234',
  });

  staffUser = await User.create({
    name: 'Staff User',
    phone: '9876543211',
    role: 'staff',
    password: 'Secret@123',
  });

  testProduct = await Product.create({
    name: 'Whey Isolate 1kg',
    brand: 'MuscleBlaze',
    category: new mongoose.Types.ObjectId(),
    hsn: '21069099',
    gstRate: 18,
    variants: [
      {
        flavour: 'Chocolate',
        size: '1kg',
        sku: 'MB-ISO-1KG',
        mrp: 400000,
        sellingPrice: 350000,
        purchasePrice: 250000,
        stock: 10,
      },
    ],
  });
  testVariantId = testProduct.variants[0]._id;

  testBatch = await StockBatch.create({
    productId: testProduct._id,
    variantId: testVariantId,
    batchNo: 'B-P4-001',
    qtyReceived: 10,
    qtyLeft: 10,
    unitCostPaise: 250000,
    expiryDate: new Date('2027-12-31'),
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 4: Customers, Ledger, Dues, Returns & Day Close', () => {
  let customer;
  let testBill;

  it('creates customer with opening dues and tracks balance', async () => {
    customer = await customerService.create({
      name: 'Amit Deshmukh',
      phone: '9822001122',
      openingDuePaise: 50000, // ₹500
    });

    expect(customer.name).toBe('Amit Deshmukh');
    expect(customer.dueBalancePaise).toBe(50000);
  });

  it('collects due payment using FIFO allocation and creates CustomerLedger entry', async () => {
    const res = await dueService.collectDue(
      {
        customerId: customer._id,
        amountPaise: 20000, // ₹200 payment against ₹500 due
        mode: 'cash',
      },
      staffUser
    );

    expect(res.receiptNo).toMatch(/^RC\/\d{4}\/\d{6}$/);
    expect(res.customer.dueBalancePaise).toBe(30000); // 500 - 200 = 300 remaining

    const ledger = await CustomerLedger.find({ customerId: customer._id });
    expect(ledger.length).toBe(1);
    expect(ledger[0].type).toBe('due_payment');
    expect(ledger[0].amountPaise).toBe(-20000);
    expect(ledger[0].balanceAfterPaise).toBe(30000);
  });

  it('processes return and generates credit note with stock restoration', async () => {
    // Create a bill
    testBill = await Bill.create({
      billNo: 'PS/2627/000099',
      fy: '2627',
      customerId: customer._id,
      customerSnapshot: { name: customer.name, phone: customer.phone },
      items: [
        {
          lineId: 'line-1',
          productId: testProduct._id,
          variantId: testVariantId,
          nameSnapshot: 'Whey Isolate 1kg',
          qty: 2,
          returnedQty: 0,
          mrpPaise: 400000,
          unitPricePaise: 350000,
          gstRate: 18,
          taxablePaise: 593220,
          cgstPaise: 53390,
          sgstPaise: 53390,
          netPaise: 700000,
          unitCostPaise: 250000,
          costTotalPaise: 500000,
          allocations: [
            {
              batchId: testBatch._id,
              batchNo: 'B-P4-001',
              qty: 2,
              unitCostPaise: 250000,
            },
          ],
        },
      ],
      subtotalPaise: 700000,
      taxablePaise: 593220,
      cgstPaise: 53390,
      sgstPaise: 53390,
      grandTotalPaise: 700000,
      paidPaise: 500000,
      duePaise: 200000, // ₹2000 due
      staffId: ownerUser._id,
      staffNameSnapshot: 'Owner',
    });

    // Initial batch qty
    const batchBefore = await StockBatch.findById(testBatch._id);
    expect(batchBefore.qtyLeft).toBe(10);

    // Return 1 unit
    const creditNote = await returnService.createReturn({
      billId: testBill._id,
      returnLines: [{ lineId: 'line-1', qty: 1, isDamaged: false }],
      settlement: { payouts: [] },
      reason: 'changed_mind',
      note: 'Customer bought wrong flavour',
      userId: ownerUser._id,
    });

    expect(creditNote.creditNoteNo).toMatch(/^CN\/\d{4}\/\d{6}$/);
    expect(creditNote.items[0].qty).toBe(1);
    expect(creditNote.items[0].stockOutcome).toBe('sealed');

    // Batch should have 1 restored
    const batchAfter = await StockBatch.findById(testBatch._id);
    expect(batchAfter.qtyLeft).toBe(11);

    // Bill due should have been reduced by credit note
    const updatedBill = await Bill.findById(testBill._id);
    expect(updatedBill.items[0].returnedQty).toBe(1);
    expect(updatedBill.duePaise).toBe(0); // Due of 200000 absorbed by 350000 credit note
  });

  it('calculates Day Close cash summary with strict formula and redaction for staff', async () => {
    const todayDateStr = new Date().toISOString().slice(0, 10);

    // Record a sale payment
    await Payment.create({
      billId: testBill._id,
      mode: 'cash',
      amountPaise: 150000, // ₹1,500 cash sale
      type: 'sale',
    });

    // Record an expense cash entry
    await dayCloseService.recordCashEntry({
      date: todayDateStr,
      type: 'expense',
      amountPaise: 20000, // ₹200 tea/cleaning expense
      note: 'Tea and coffee for gym lounge',
      userId: staffUser._id,
    });

    // Owner view: includes expectedCashPaise
    const ownerSummary = await dayCloseService.getDaySummary(todayDateStr, false);
    expect(ownerSummary.expectedCashPaise).toBeDefined();

    // Staff view: expectedCashPaise is stripped (blind count)
    const staffSummary = await dayCloseService.getDaySummary(todayDateStr, true);
    expect(staffSummary.expectedCashPaise).toBeUndefined();

    // Close day
    const dayClose = await dayCloseService.closeDay({
      date: todayDateStr,
      countedCashPaise: 130000, // 1500 - 200 = 1300 expected, counted 1300 -> 0 difference
      denominations: { '500': 2, '100': 3 },
      note: 'All tallies match',
      userId: ownerUser._id,
      isStaff: false,
    });

    expect(dayClose.status).toBe('active');
    expect(dayClose.differencePaise).toBe(0);
  });

  it('generates refill reminders for customers with past supplement purchases', async () => {
    // Backdate a bill to 35 days ago
    const pastDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    await Bill.create({
      billNo: 'PS/2627/000001',
      fy: '2627',
      customerId: customer._id,
      customerSnapshot: { name: customer.name, phone: customer.phone },
      items: [
        {
          lineId: 'line-past',
          productId: testProduct._id,
          variantId: testVariantId,
          nameSnapshot: 'Whey Isolate 1kg',
          qty: 1,
          returnedQty: 0,
          mrpPaise: 400000,
          unitPricePaise: 350000,
          gstRate: 18,
          taxablePaise: 296610,
          cgstPaise: 26695,
          sgstPaise: 26695,
          netPaise: 350000,
          unitCostPaise: 250000,
          costTotalPaise: 250000,
        },
      ],
      subtotalPaise: 350000,
      taxablePaise: 296610,
      cgstPaise: 26695,
      sgstPaise: 26695,
      grandTotalPaise: 350000,
      paidPaise: 350000,
      staffId: ownerUser._id,
      staffNameSnapshot: 'Owner',
      createdAt: pastDate,
    });

    const reminders = await customerService.getRefillReminders();
    expect(reminders.length).toBeGreaterThanOrEqual(1);
    const custReminder = reminders.find((r) => r.phone === customer.phone);
    expect(custReminder).toBeDefined();
    expect(custReminder.daysAgo).toBeGreaterThanOrEqual(30);
    expect(custReminder.waLink).toContain('wa.me');
  });
});
