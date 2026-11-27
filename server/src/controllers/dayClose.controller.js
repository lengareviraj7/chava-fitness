import { dayCloseService } from '../services/billing/dayClose.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const dayCloseController = {
  async getSummary(req, res, next) {
    try {
      const { date } = req.query;
      const isStaff = req.user.role === 'staff';
      const summary = await dayCloseService.getDaySummary(date, isStaff);
      return sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  },

  async addCashEntry(req, res, next) {
    try {
      const { date, type, amountPaise, note } = req.body;
      const entry = await dayCloseService.recordCashEntry({
        date,
        type,
        amountPaise: Number(amountPaise),
        note,
        userId: req.user._id,
      });
      return sendSuccess(res, { entry }, 'Cash entry recorded', 201);
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },

  async closeDay(req, res, next) {
    try {
      const { date, openingCashPaise, countedCashPaise, denominations, note } = req.body;
      const isStaff = req.user.role === 'staff';
      const dayClose = await dayCloseService.closeDay({
        date,
        openingCashPaise: openingCashPaise !== undefined ? Number(openingCashPaise) : null,
        countedCashPaise: Number(countedCashPaise),
        denominations,
        note,
        userId: req.user._id,
        isStaff,
      });
      return sendSuccess(res, { dayClose }, 'Day closed successfully', 201);
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },

  async listHistory(req, res, next) {
    try {
      const { limit } = req.query;
      const history = await dayCloseService.listHistory({ limit });
      return sendSuccess(res, { history });
    } catch (err) {
      next(err);
    }
  },
};
