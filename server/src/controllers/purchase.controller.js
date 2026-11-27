import { sendSuccess } from '../utils/apiResponse.js';
import { purchaseService } from '../services/purchase.service.js';

export const purchaseController = {
  async list(req, res, next) {
    try {
      const result = await purchaseService.list(req.query);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const purchase = await purchaseService.getById(req.params.id);
      return sendSuccess(res, { purchase });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const purchase = await purchaseService.createPurchase(req.body, req.user._id);
      return sendSuccess(res, { purchase }, 'Purchase inward recorded', 201);
    } catch (err) {
      next(err);
    }
  },

  async voidPurchase(req, res, next) {
    try {
      const purchase = await purchaseService.voidPurchase(req.params.id, req.body.reason, req.user._id);
      return sendSuccess(res, { purchase }, 'Purchase voided');
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },
};
