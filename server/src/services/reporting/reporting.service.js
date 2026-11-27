import mongoose from 'mongoose';
import { Bill } from '../../models/Bill.js';
import { CreditNote } from '../../models/CreditNote.js';
import { Payment } from '../../models/Payment.js';
import { StockBatch } from '../../models/StockBatch.js';
import { StockMovement } from '../../models/StockMovement.js';
import { Customer } from '../../models/Customer.js';
import { Product } from '../../models/Product.js';
import { suggestedReorderQty } from './definitions.js';

export function parseDateRange({ from, to, preset = 'this_month' }) {
  const now = new Date();
  let start;
  let end = new Date();

  if (from && to) {
    start = new Date(`${from}T00:00:00.000+05:30`);
    end = new Date(`${to}T23:59:59.999+05:30`);
  } else if (preset === 'today') {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    start = new Date(`${todayStr}T00:00:00.000+05:30`);
    end = new Date(`${todayStr}T23:59:59.999+05:30`);
  } else if (preset === 'last_7_days') {
    start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (preset === 'this_year') {
    const year = now.getFullYear();
    start = new Date(`${year}-01-01T00:00:00.000+05:30`);
  } else {
    // Default: this month
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    start = new Date(`${year}-${month}-01T00:00:00.000+05:30`);
  }

  return { start, end };
}

export const reportingService = {
  /**
   * 1. Sales Report
   */
  async getSalesReport(params) {
    const { start, end } = parseDateRange(params);

    const bills = await Bill.find({
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'void' },
    });

    const creditNotes = await CreditNote.find({
      createdAt: { $gte: start, $lte: end },
    });

    const payments = await Payment.find({
      createdAt: { $gte: start, $lte: end },
    });

    let grossSalesPaise = 0;
    let taxableSalesPaise = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    let totalDuesGivenPaise = 0;

    for (const b of bills) {
      grossSalesPaise += b.grandTotalPaise;
      taxableSalesPaise += b.taxablePaise;
      cgstPaise += b.cgstPaise || 0;
      sgstPaise += b.sgstPaise || 0;
      igstPaise += b.igstPaise || 0;
      totalDuesGivenPaise += b.duePaise || 0;
    }

    let returnsTotalPaise = 0;
    let returnsTaxablePaise = 0;
    let returnsCgstPaise = 0;
    let returnsSgstPaise = 0;
    let returnsIgstPaise = 0;

    for (const cn of creditNotes) {
      returnsTotalPaise += cn.grandTotalPaise;
      returnsTaxablePaise += cn.totals.taxablePaise;
      returnsCgstPaise += cn.totals.cgstPaise || 0;
      returnsSgstPaise += cn.totals.sgstPaise || 0;
      returnsIgstPaise += cn.totals.igstPaise || 0;
    }

    const netSalesPaise = grossSalesPaise - returnsTotalPaise;
    const netTaxablePaise = taxableSalesPaise - returnsTaxablePaise;
    const netCgstPaise = cgstPaise - returnsCgstPaise;
    const netSgstPaise = sgstPaise - returnsSgstPaise;
    const netIgstPaise = igstPaise - returnsIgstPaise;
    const netGstPaise = netCgstPaise + netSgstPaise + netIgstPaise;

    // Payment modes
    let cashPaid = 0;
    let upiPaid = 0;
    let cardPaid = 0;
    let dueCollected = 0;

    for (const p of payments) {
      if (p.type === 'sale') {
        if (p.mode === 'cash') cashPaid += p.amountPaise;
        else if (p.mode === 'upi') upiPaid += p.amountPaise;
        else if (p.mode === 'card') cardPaid += p.amountPaise;
      } else if (p.type === 'due' || p.type === 'due_payment') {
        dueCollected += p.amountPaise;
      }
    }

    return {
      period: { start, end },
      summary: {
        billsCount: bills.length,
        returnsCount: creditNotes.length,
        grossSalesPaise,
        returnsTotalPaise,
        netSalesPaise,
        netTaxablePaise,
        netGstPaise,
        netCgstPaise,
        netSgstPaise,
        netIgstPaise,
        totalDuesGivenPaise,
      },
      paymentModes: {
        cashPaid,
        upiPaid,
        cardPaid,
        dueCollected,
      },
    };
  },

  /**
   * 2. GSTR-1 Outward Supply Register
   */
  async getGstr1Report(params) {
    const { start, end } = parseDateRange(params);

    const bills = await Bill.find({
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'void' },
    });

    const creditNotes = await CreditNote.find({
      createdAt: { $gte: start, $lte: end },
    });

    const b2b = [];
    const b2csByRate = {}; // Intra-state B2C by GST Rate (5, 12, 18, 28)

    for (const b of bills) {
      const isB2B = Boolean(b.customerSnapshot?.gstin);
      if (isB2B) {
        b2b.push({
          billNo: b.billNo,
          date: b.createdAt,
          customerName: b.customerSnapshot.name,
          gstin: b.customerSnapshot.gstin,
          taxablePaise: b.taxablePaise,
          cgstPaise: b.cgstPaise || 0,
          sgstPaise: b.sgstPaise || 0,
          igstPaise: b.igstPaise || 0,
          grandTotalPaise: b.grandTotalPaise,
        });
      } else {
        // Group items by GST rate
        for (const item of b.items) {
          const rate = item.gstRate || 18;
          if (!b2csByRate[rate]) {
            b2csByRate[rate] = {
              gstRate: rate,
              taxablePaise: 0,
              cgstPaise: 0,
              sgstPaise: 0,
              igstPaise: 0,
              totalPaise: 0,
            };
          }
          b2csByRate[rate].taxablePaise += item.taxablePaise;
          b2csByRate[rate].cgstPaise += item.cgstPaise || 0;
          b2csByRate[rate].sgstPaise += item.sgstPaise || 0;
          b2csByRate[rate].igstPaise += item.igstPaise || 0;
          b2csByRate[rate].totalPaise += item.netPaise;
        }
      }
    }

    const cdnr = creditNotes.map((cn) => ({
      creditNoteNo: cn.creditNoteNo,
      billNo: cn.billNoSnapshot,
      date: cn.createdAt,
      customerName: cn.customerSnapshot?.name || 'Walk-in',
      taxablePaise: cn.totals.taxablePaise,
      cgstPaise: cn.totals.cgstPaise || 0,
      sgstPaise: cn.totals.sgstPaise || 0,
      igstPaise: cn.totals.igstPaise || 0,
      grandTotalPaise: cn.grandTotalPaise,
    }));

    return {
      period: { start, end },
      b2b,
      b2cs: Object.values(b2csByRate).sort((a, b) => a.gstRate - b.gstRate),
      cdnr,
      docIssued: {
        invoicesIssued: bills.length,
        creditNotesIssued: creditNotes.length,
      },
    };
  },

  /**
   * 3. Stock Valuation Report
   */
  async getStockValuationReport() {
    const batches = await StockBatch.find({ qtyLeft: { $gt: 0 } })
      .populate('productId', 'name brand category')
      .sort({ expiryDate: 1 });

    const products = await Product.find({ isActive: true });
    const variantMap = new Map();
    for (const p of products) {
      for (const v of p.variants) {
        variantMap.set(v._id.toString(), {
          variant: v,
          product: p,
        });
      }
    }

    const now = new Date();
    const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const in60d = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const in90d = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    let totalCostValuationPaise = 0;
    let totalRetailValuationPaise = 0;

    let expiredValuePaise = 0;
    let within30dValuePaise = 0;
    let within60dValuePaise = 0;
    let safeStockValuePaise = 0;

    const batchRows = [];

    for (const b of batches) {
      const vInfo = variantMap.get(b.variantId.toString());
      const sellingPrice = vInfo?.variant?.sellingPrice || b.unitCostPaise;
      const costVal = b.qtyLeft * b.unitCostPaise;
      const retailVal = b.qtyLeft * sellingPrice;

      totalCostValuationPaise += costVal;
      totalRetailValuationPaise += retailVal;

      if (b.expiryDate && new Date(b.expiryDate) < now) {
        expiredValuePaise += costVal;
      } else if (b.expiryDate && new Date(b.expiryDate) < in30d) {
        within30dValuePaise += costVal;
      } else if (b.expiryDate && new Date(b.expiryDate) < in60d) {
        within60dValuePaise += costVal;
      } else {
        safeStockValuePaise += costVal;
      }

      batchRows.push({
        batchId: b._id,
        batchNo: b.batchNo,
        productName: b.productId?.name || 'Unknown Product',
        brand: b.productId?.brand || '',
        variantName: `${vInfo?.variant?.flavour || ''} ${vInfo?.variant?.size || ''}`.trim(),
        qtyLeft: b.qtyLeft,
        unitCostPaise: b.unitCostPaise,
        sellingPricePaise: sellingPrice,
        costValuationPaise: costVal,
        retailValuationPaise: retailVal,
        expiryDate: b.expiryDate,
        isExpired: b.expiryDate && new Date(b.expiryDate) < now,
      });
    }

    const potentialProfitPaise = totalRetailValuationPaise - totalCostValuationPaise;

    return {
      summary: {
        totalBatches: batches.length,
        totalCostValuationPaise,
        totalRetailValuationPaise,
        potentialProfitPaise,
        marginPct:
          totalRetailValuationPaise > 0
            ? Math.round((potentialProfitPaise * 1000) / totalRetailValuationPaise) / 10
            : 0,
      },
      expiryBuckets: {
        expiredValuePaise,
        within30dValuePaise,
        within60dValuePaise,
        safeStockValuePaise,
      },
      batches: batchRows,
    };
  },

  /**
   * 4. Profit & Loss Report (Owner Only)
   */
  async getProfitLossReport(params) {
    const { start, end } = parseDateRange(params);

    const bills = await Bill.find({
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'void' },
    });

    const creditNotes = await CreditNote.find({
      createdAt: { $gte: start, $lte: end },
    });

    // Write-offs / stock adjustments
    const adjustments = await StockMovement.find({
      createdAt: { $gte: start, $lte: end },
      type: 'adjustment',
      qty: { $lt: 0 },
    });

    let grossRevenuePaise = 0;
    let cogsPaise = 0;

    for (const b of bills) {
      grossRevenuePaise += b.taxablePaise;
      for (const item of b.items) {
        cogsPaise += item.costTotalPaise || 0;
      }
    }

    let returnsRevenuePaise = 0;
    let returnsCostRestoredPaise = 0;

    for (const cn of creditNotes) {
      returnsRevenuePaise += cn.totals.taxablePaise;
      returnsCostRestoredPaise += cn.profitAdjustmentPaise < 0 ? -cn.profitAdjustmentPaise : 0;
    }

    let stockLossesPaise = 0;
    for (const adj of adjustments) {
      stockLossesPaise += Math.abs(adj.qty) * (adj.unitCostPaise || 0);
    }

    const netTaxableRevenuePaise = grossRevenuePaise - returnsRevenuePaise;
    const netCogsPaise = Math.max(0, cogsPaise - returnsCostRestoredPaise);
    const grossProfitPaise = netTaxableRevenuePaise - netCogsPaise;
    const netProfitPaise = grossProfitPaise - stockLossesPaise;

    return {
      period: { start, end },
      netTaxableRevenuePaise,
      netCogsPaise,
      grossProfitPaise,
      grossMarginPct:
        netTaxableRevenuePaise > 0
          ? Math.round((grossProfitPaise * 1000) / netTaxableRevenuePaise) / 10
          : 0,
      stockLossesPaise,
      netProfitPaise,
    };
  },

  /**
   * 5. Dues Aging Report
   */
  async getDuesAgingReport() {
    const customersWithDues = await Customer.find({
      dueBalancePaise: { $gt: 0 },
      isActive: true,
    }).sort({ dueBalancePaise: -1 });

    const now = Date.now();
    let totalDuesPaise = 0;
    let b0to15Paise = 0;
    let b16to30Paise = 0;
    let b31to60Paise = 0;
    let b60plusPaise = 0;

    const list = [];

    for (const c of customersWithDues) {
      totalDuesPaise += c.dueBalancePaise;

      // Find oldest unpaid bill for this customer
      const oldestBill = await Bill.findOne({
        customerId: c._id,
        duePaise: { $gt: 0 },
        status: { $ne: 'void' },
      }).sort({ createdAt: 1 });

      const days = oldestBill
        ? Math.floor((now - new Date(oldestBill.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (days <= 15) b0to15Paise += c.dueBalancePaise;
      else if (days <= 30) b16to30Paise += c.dueBalancePaise;
      else if (days <= 60) b31to60Paise += c.dueBalancePaise;
      else b60plusPaise += c.dueBalancePaise;

      list.push({
        customerId: c._id,
        name: c.name,
        phone: c.phone,
        dueBalancePaise: c.dueBalancePaise,
        oldestBillDate: oldestBill?.createdAt || null,
        daysAging: days,
      });
    }

    return {
      totalDuesPaise,
      customersCount: customersWithDues.length,
      buckets: {
        b0to15Paise,
        b16to30Paise,
        b31to60Paise,
        b60plusPaise,
      },
      customers: list,
    };
  },

  /**
   * 6. Fast / Slow Moving Analysis & Reorder Recommendations
   */
  async getFastSlowMovingReport() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Aggregate sales by variant in trailing 30 days
    const salesAgg = await Bill.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $ne: 'void' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.variantId',
          soldQty: { $sum: '$items.qty' },
          returnedQty: { $sum: { $ifNull: ['$items.returnedQty', 0] } },
        },
      },
    ]);

    const salesMap = new Map();
    for (const s of salesAgg) {
      salesMap.set(s._id.toString(), Math.max(0, s.soldQty - s.returnedQty));
    }

    const products = await Product.find({ isActive: true });
    const items = [];

    for (const p of products) {
      for (const v of p.variants) {
        if (!v.isActive) continue;
        const netSold30d = salesMap.get(v._id.toString()) || 0;
        const avgDailySale = netSold30d / 30;
        const qtyInStock = v.stock || 0;

        const reorderCalc = suggestedReorderQty({
          avgDailySale,
          qtyInStock,
          lowStockLimit: v.minStockLevel || 3,
          hasSalesHistory: netSold30d > 0,
        });

        const daysOfStockLeft =
          avgDailySale > 0 ? Math.round(qtyInStock / avgDailySale) : qtyInStock > 0 ? 999 : 0;

        items.push({
          productId: p._id,
          variantId: v._id,
          productName: p.name,
          brand: p.brand,
          flavour: v.flavour,
          size: v.size,
          sku: v.sku,
          stock: qtyInStock,
          minStockLevel: v.minStockLevel || 3,
          unitsSold30d: netSold30d,
          avgDailySale: Number(avgDailySale.toFixed(2)),
          daysOfStockLeft,
          suggestedReorderQty: reorderCalc.suggestedQty,
          status:
            qtyInStock <= (v.minStockLevel || 3)
              ? 'critical'
              : netSold30d >= 10
              ? 'fast'
              : 'normal',
        });
      }
    }

    // Sort fast-moving first, critical at top
    items.sort((a, b) => b.unitsSold30d - a.unitsSold30d);

    return {
      totalVariants: items.length,
      items,
    };
  },
};
