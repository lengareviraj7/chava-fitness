import { sendSuccess } from '../utils/apiResponse.js';
import { billingService } from '../services/billing/billing.service.js';

export const billingController = {
  async getQuote(req, res, next) {
    try {
      const quote = await billingService.getQuote(req.body);
      return sendSuccess(res, { quote });
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },

  async checkout(req, res, next) {
    try {
      const result = await billingService.checkout(req.body, req.user);
      return sendSuccess(res, result, 'Bill checkout completed', 201);
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },

  async listBills(req, res, next) {
    try {
      const result = await billingService.listBills({
        ...req.query,
        userRole: req.user.role,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getBillById(req, res, next) {
    try {
      const result = await billingService.getBillById(req.params.id, req.user.role);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async holdCart(req, res, next) {
    try {
      const held = await billingService.holdCart({
        ...req.body,
        userId: req.user._id,
      });
      return sendSuccess(res, { held }, 'Cart held', 201);
    } catch (err) {
      next(err);
    }
  },

  async listHeld(req, res, next) {
    try {
      const heldCarts = await billingService.listHeldCarts();
      return sendSuccess(res, { heldCarts });
    } catch (err) {
      next(err);
    }
  },

  async recallHeld(req, res, next) {
    try {
      const held = await billingService.recallHeldCart(req.params.holdCode);
      return sendSuccess(res, { held });
    } catch (err) {
      next(err);
    }
  },
};
