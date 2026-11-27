import { sendSuccess } from '../utils/apiResponse.js';
import { stockService } from '../services/stock.service.js';

export const stockController = {
  async list(req, res, next) {
    try {
      const result = await stockService.listStock({
        ...req.query,
        userRole: req.user.role,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getVariantStock(req, res, next) {
    try {
      const result = await stockService.getVariantStock(req.params.variantId, req.user.role);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async adjustStock(req, res, next) {
    try {
      const result = await stockService.adjustStock({
        ...req.body,
        userId: req.user._id,
      });
      return sendSuccess(res, result, 'Stock adjusted successfully');
    } catch (err) {
      next(err);
    }
  },

  async getAlerts(req, res, next) {
    try {
      const alerts = await stockService.getAlerts();
      return sendSuccess(res, alerts);
    } catch (err) {
      next(err);
    }
  },
};
