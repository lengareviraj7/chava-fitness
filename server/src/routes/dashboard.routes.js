import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { Product } from '../models/Product.js';
import { Settings } from '../models/Settings.js';
import { Bill } from '../models/Bill.js';
import { CreditNote } from '../models/CreditNote.js';
import { Customer } from '../models/Customer.js';
import { DayClose } from '../models/DayClose.js';

export const dashboardRouter = Router();

dashboardRouter.get(['/', '/summary'], authenticate, async (req, res, next) => {
  try {
    const isOwner = req.user.role === 'owner';
    const settings = (await Settings.findOne()) || {};

    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const startOfToday = new Date(`${todayStr}T00:00:00.000+05:30`);
    const endOfToday = new Date(`${todayStr}T23:59:59.999+05:30`);

    const startOfWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Live queries
    const [
      totalProducts,
      todayBills,
      todayCreditNotes,
      weekBills,
      monthBills,
      customersWithDues,
      recentBills,
    ] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Bill.find({ createdAt: { $gte: startOfToday, $lte: endOfToday }, status: { $ne: 'void' } }),
      CreditNote.find({ createdAt: { $gte: startOfToday, $lte: endOfToday } }),
      Bill.find({ createdAt: { $gte: startOfWeek }, status: { $ne: 'void' } }),
      Bill.find({ createdAt: { $gte: startOfMonth }, status: { $ne: 'void' } }),
      Customer.find({ dueBalancePaise: { $gt: 0 }, isActive: true }),
      Bill.find({ status: { $ne: 'void' } })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('billNo grandTotalPaise customerSnapshot createdAt staffNameSnapshot status'),
    ]);

    // Low stock count
    const lowStockProducts = await Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$variants' },
      { $match: { 'variants.isActive': true } },
      {
        $addFields: {
          isLow: { $lte: ['$variants.stock', '$variants.minStockLevel'] },
        },
      },
      { $match: { isLow: true } },
      { $count: 'count' },
    ]);

    // Today sales math
    const grossTodaySalesPaise = todayBills.reduce((s, b) => s + b.grandTotalPaise, 0);
    const returnsTodayPaise = todayCreditNotes.reduce((s, cn) => s + cn.grandTotalPaise, 0);
    const todaySalesPaise = Math.max(0, grossTodaySalesPaise - returnsTodayPaise);

    // Week and Month sales
    const weekSalesPaise = weekBills.reduce((s, b) => s + b.grandTotalPaise, 0);
    const monthSalesPaise = monthBills.reduce((s, b) => s + b.grandTotalPaise, 0);

    // Total pending customer dues
    const pendingDuesPaise = customersWithDues.reduce((s, c) => s + (c.dueBalancePaise || 0), 0);

    // Profit math (strictly owner only)
    let profitPaise = undefined;
    if (isOwner) {
      let grossProfit = 0;
      for (const b of todayBills) {
        grossProfit += (b.profitPaise || 0);
      }
      for (const cn of todayCreditNotes) {
        grossProfit += (cn.profitAdjustmentPaise || 0);
      }
      profitPaise = grossProfit;
    }

    // Top selling products in trailing 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const topProductsAgg = await Bill.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: { $ne: 'void' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.nameSnapshot',
          salesCount: { $sum: '$items.qty' },
          revenuePaise: { $sum: '$items.netPaise' },
        },
      },
      { $sort: { salesCount: -1 } },
      { $limit: 5 },
    ]);

    const topProducts = topProductsAgg.map((tp) => ({
      name: tp._id,
      salesCount: tp.salesCount,
      revenuePaise: tp.revenuePaise,
    }));

    // Check if yesterday was closed
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterday);
    const yesterdayClose = await DayClose.findOne({ date: yesterdayStr, status: 'active' });
    const unclosedDayWarning = isOwner && !yesterdayClose;

    const payload = {
      isDemo: false,
      shopName: settings.shopName || 'CHAVA FITNESS CLUB',
      today: {
        salesPaise: todaySalesPaise,
        profitPaise: isOwner ? profitPaise : undefined,
        bills: todayBills.length,
        returns: todayCreditNotes.length,
      },
      todaySalesPaise,
      weekSalesPaise,
      monthSalesPaise,
      profitPaise,
      totalProducts,
      lowStockCount: lowStockProducts[0]?.count || 0,
      pendingDuesPaise,
      customersWithDuesCount: customersWithDues.length,
      unclosedDayWarning,
      topProducts,
      recentBills,
    };

    return sendSuccess(res, payload);
  } catch (err) {
    next(err);
  }
});
