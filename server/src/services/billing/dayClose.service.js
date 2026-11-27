import mongoose from 'mongoose';
import { DayClose } from '../../models/DayClose.js';
import { CashEntry } from '../../models/CashEntry.js';
import { Payment } from '../../models/Payment.js';
import { Bill } from '../../models/Bill.js';
import { CreditNote } from '../../models/CreditNote.js';

export function getKolkataDateString(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return parts; // YYYY-MM-DD
}

export function getDateRangeUTC(dateStr) {
  // Parse date in Asia/Kolkata: 00:00:00.000 to 23:59:59.999
  const start = new Date(`${dateStr}T00:00:00.000+05:30`);
  const end = new Date(`${dateStr}T23:59:59.999+05:30`);
  return { start, end };
}

export const dayCloseService = {
  /**
   * Get expected numbers and live breakdown for a given date
   */
  async getDaySummary(dateStr = getKolkataDateString(), isStaff = false) {
    const { start, end } = getDateRangeUTC(dateStr);

    // Opening cash: from most recent active DayClose before this date
    const lastClose = await DayClose.findOne({
      status: 'active',
      date: { $lt: dateStr },
    }).sort({ date: -1 });

    const openingCashPaise = lastClose ? lastClose.countedCashPaise : 0;

    // Payments in date range
    const payments = await Payment.find({
      createdAt: { $gte: start, $lte: end },
    });

    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let cashDueCollected = 0;
    let upiDueCollected = 0;
    let cardDueCollected = 0;
    let cashRefunds = 0;

    for (const p of payments) {
      if (p.type === 'sale') {
        if (p.mode === 'cash') cashSales += p.amountPaise;
        else if (p.mode === 'upi') upiSales += p.amountPaise;
        else if (p.mode === 'card') cardSales += p.amountPaise;
      } else if (p.type === 'due_collection') {
        if (p.mode === 'cash') cashDueCollected += p.amountPaise;
        else if (p.mode === 'upi') upiDueCollected += p.amountPaise;
        else if (p.mode === 'card') cardDueCollected += p.amountPaise;
      } else if (p.type === 'refund') {
        if (p.mode === 'cash') cashRefunds += Math.abs(p.amountPaise);
      }
    }

    // Cash Entries in date range
    const cashEntries = await CashEntry.find({ date: dateStr });
    let cashIn = 0;
    let expenses = 0;
    let bankDeposits = 0;
    let ownerDraws = 0;

    for (const ce of cashEntries) {
      if (ce.type === 'cash_in') cashIn += ce.amountPaise;
      else if (ce.type === 'expense') expenses += ce.amountPaise;
      else if (ce.type === 'bank_deposit') bankDeposits += ce.amountPaise;
      else if (ce.type === 'owner_draw') ownerDraws += ce.amountPaise;
    }

    const billsCount = await Bill.countDocuments({
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'void' },
    });

    const returnsCount = await CreditNote.countDocuments({
      createdAt: { $gte: start, $lte: end },
    });

    const expectedCashPaise =
      openingCashPaise +
      cashSales +
      cashDueCollected +
      cashIn -
      cashRefunds -
      expenses -
      bankDeposits -
      ownerDraws;

    const figures = {
      openingCashPaise,
      cashSales,
      upiSales,
      cardSales,
      cashDueCollected,
      upiDueCollected,
      cardDueCollected,
      cashRefunds,
      cashIn,
      expenses,
      bankDeposits,
      ownerDraws,
      billsCount,
      returnsCount,
    };

    // Check if already closed today
    const currentClose = await DayClose.findOne({ date: dateStr, status: 'active' });

    const result = {
      date: dateStr,
      isClosed: !!currentClose,
      currentClose,
      cashEntries,
      figures,
    };

    if (!isStaff) {
      result.expectedCashPaise = expectedCashPaise;
    }

    return result;
  },

  /**
   * Record a petty cash entry (cash in, expense, bank deposit, owner draw)
   */
  async recordCashEntry({ date = getKolkataDateString(), type, amountPaise, note, userId }) {
    if (!amountPaise || amountPaise <= 0) {
      const err = new Error('Amount must be positive');
      err.statusCode = 400;
      throw err;
    }
    return CashEntry.create({
      date,
      type,
      amountPaise,
      note: note.trim(),
      createdBy: userId,
    });
  },

  /**
   * Close the day with counted cash
   */
  async closeDay({
    date = getKolkataDateString(),
    openingCashPaise: userOpening = null,
    countedCashPaise,
    denominations = {},
    note = '',
    userId,
    isStaff = false,
  }) {
    const summary = await this.getDaySummary(date, false);
    const openingCashPaise =
      userOpening !== null ? userOpening : summary.figures.openingCashPaise;

    const expectedCashPaise =
      openingCashPaise +
      summary.figures.cashSales +
      summary.figures.cashDueCollected +
      summary.figures.cashIn -
      summary.figures.cashRefunds -
      summary.figures.expenses -
      summary.figures.bankDeposits -
      summary.figures.ownerDraws;

    const differencePaise = countedCashPaise - expectedCashPaise;

    // Check version
    const existing = await DayClose.find({ date });
    const version = existing.length + 1;

    // Supersede any active record for this date
    await DayClose.updateMany({ date, status: 'active' }, { status: 'superseded' });

    const dayClose = await DayClose.create({
      date,
      version,
      status: 'active',
      openingCashPaise,
      figures: summary.figures,
      expectedCashPaise,
      countedCashPaise,
      differencePaise,
      denominations,
      note: note.trim(),
      closedBy: userId,
    });

    if (isStaff) {
      const sanitized = dayClose.toObject();
      delete sanitized.expectedCashPaise;
      delete sanitized.differencePaise;
      return sanitized;
    }

    return dayClose;
  },

  /**
   * Get past day close history
   */
  async listHistory({ limit = 30 } = {}) {
    return DayClose.find({ status: 'active' })
      .sort({ date: -1 })
      .limit(Number(limit))
      .populate('closedBy', 'name phone role');
  },
};
