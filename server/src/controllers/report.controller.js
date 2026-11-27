import { reportingService } from '../services/reporting/reporting.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const reportController = {
  async getSales(req, res, next) {
    try {
      const { from, to, preset } = req.query;
      const data = await reportingService.getSalesReport({ from, to, preset });
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getGstr1(req, res, next) {
    try {
      const { from, to, preset } = req.query;
      const data = await reportingService.getGstr1Report({ from, to, preset });
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getStockValuation(req, res, next) {
    try {
      const data = await reportingService.getStockValuationReport();
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getProfitLoss(req, res, next) {
    try {
      if (req.user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          error: { message: 'Owner permission required', code: 'FORBIDDEN' },
        });
      }
      const { from, to, preset } = req.query;
      const data = await reportingService.getProfitLossReport({ from, to, preset });
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getDuesAging(req, res, next) {
    try {
      const data = await reportingService.getDuesAgingReport();
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getFastSlowMoving(req, res, next) {
    try {
      const data = await reportingService.getFastSlowMovingReport();
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
};
