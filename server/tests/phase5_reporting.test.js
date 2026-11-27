import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User } from '../src/models/User.js';
import { Product } from '../src/models/Product.js';
import { StockBatch } from '../src/models/StockBatch.js';
import { Bill } from '../src/models/Bill.js';
import { CreditNote } from '../src/models/CreditNote.js';
import { Customer } from '../src/models/Customer.js';
import { Payment } from '../src/models/Payment.js';
import { reportingService } from '../src/services/reporting/reporting.service.js';

let mongod;
let testProduct;
let testVariantId;
let testBatch;
let testCustomer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  testCustomer = await Customer.create({
    name: 'Vikram Shinde',
    phone: '9876543222',
    dueBalancePaise: 150000,
  });

  testProduct = await Product.create({
    name: 'Creatine Monohydrate 250g',
    brand: 'MuscleBlaze',
    category: new mongoose.Types.ObjectId(),
    hsn: '21069099',
    gstRate: 18,
    variants: [
      {
        flavour: 'Unflavoured',
        size: '250g',
        sku: 'MB-CRE-250G',
        mrp: 120000,
        sellingPrice: 99900,
        purchasePrice: 65000,
        stock: 25,
      },
    ],
  });
  testVariantId = testProduct.variants[0]._id;

  testBatch = await StockBatch.create({
    productId: testProduct._id,
    variantId: testVariantId,
    batchNo: 'B-P5-CRE',
    qtyReceived: 30,
    qtyLeft: 25,
    unitCostPaise: 65000,
    expiryDate: new Date('2027-06-30'),
  });

  // Create a bill
  await Bill.create({
    billNo: 'PS/2627/000201',
    fy: '2627',
    customerId: testCustomer._id,
    customerSnapshot: { name: testCustomer.name, phone: testCustomer.phone },
    items: [
      {
        lineId: 'line-p5-1',
        productId: testProduct._id,
        variantId: testVariantId,
        nameSnapshot: 'Creatine Monohydrate 250g',
        qty: 2,
        returnedQty: 0,
        mrpPaise: 120000,
        unitPricePaise: 99900,
        gstRate: 18,
        taxablePaise: 169322,
        cgstPaise: 15239,
        sgstPaise: 15239,
        netPaise: 199800,
        costTotalPaise: 130000,
      },
    ],
    subtotalPaise: 199800,
    taxablePaise: 169322,
    cgstPaise: 15239,
    sgstPaise: 15239,
    grandTotalPaise: 199800,
    paidPaise: 199800,
    duePaise: 0,
    staffId: new mongoose.Types.ObjectId(),
    staffNameSnapshot: 'Cashier',
  });

  // Record payment
  await Payment.create({
    billId: new mongoose.Types.ObjectId(),
    mode: 'upi',
    amountPaise: 199800,
    type: 'sale',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Phase 5: Reports Hub & Canonical Metric Engines', () => {
  it('generates Sales Report with gross, net, taxes, and payment mode breakdown', async () => {
    const report = await reportingService.getSalesReport({ preset: 'this_month' });
    expect(report.summary.billsCount).toBeGreaterThanOrEqual(1);
    expect(report.summary.grossSalesPaise).toBe(199800);
    expect(report.summary.netSalesPaise).toBe(199800);
    expect(report.summary.netGstPaise).toBe(30478);
    expect(report.paymentModes.upiPaid).toBe(199800);
  });

  it('generates GSTR-1 outward supply register grouped by GST rate', async () => {
    const report = await reportingService.getGstr1Report({ preset: 'this_month' });
    expect(report.b2cs.length).toBeGreaterThanOrEqual(1);
    const rate18 = report.b2cs.find((r) => r.gstRate === 18);
    expect(rate18).toBeDefined();
    expect(rate18.totalPaise).toBe(199800);
    expect(report.docIssued.invoicesIssued).toBeGreaterThanOrEqual(1);
  });

  it('calculates inventory stock valuation at cost and potential retail value', async () => {
    const report = await reportingService.getStockValuationReport();
    expect(report.summary.totalBatches).toBeGreaterThanOrEqual(1);
    expect(report.summary.totalCostValuationPaise).toBe(25 * 65000); // 1,625,000 paise (₹16,250)
    expect(report.summary.totalRetailValuationPaise).toBe(25 * 99900); // 2,497,500 paise
    expect(report.summary.potentialProfitPaise).toBe(25 * (99900 - 65000));
    expect(report.batches.length).toBeGreaterThanOrEqual(1);
  });

  it('computes Profit & Loss statement with net revenue and COGS', async () => {
    const report = await reportingService.getProfitLossReport({ preset: 'this_month' });
    expect(report.netTaxableRevenuePaise).toBe(169322);
    expect(report.netCogsPaise).toBe(130000);
    expect(report.grossProfitPaise).toBe(169322 - 130000);
    expect(report.grossMarginPct).toBeGreaterThan(0);
  });

  it('produces Dues Aging report with aging buckets', async () => {
    const report = await reportingService.getDuesAgingReport();
    expect(report.totalDuesPaise).toBe(150000);
    expect(report.customersCount).toBe(1);
    expect(report.customers[0].name).toBe('Vikram Shinde');
  });

  it('performs Fast/Slow moving velocity analysis with reorder suggestion', async () => {
    const report = await reportingService.getFastSlowMovingReport();
    expect(report.totalVariants).toBeGreaterThanOrEqual(1);
    const item = report.items.find((i) => i.sku === 'MB-CRE-250G');
    expect(item).toBeDefined();
    expect(item.unitsSold30d).toBe(2);
    expect(item.stock).toBe(25);
  });
});
