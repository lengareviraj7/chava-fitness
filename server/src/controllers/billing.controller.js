import { sendSuccess } from '../utils/apiResponse.js';
import { billingService } from '../services/billing/billing.service.js';
import { dueService } from '../services/billing/due.service.js';

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

  async getUdhariList(req, res, next) {
    try {
      const result = await dueService.getUdhariList({
        filter: req.query.filter || 'all',
        search: req.query.search || '',
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async settleBillDue(req, res, next) {
    try {
      const result = await dueService.settleBillDue(
        {
          billId: req.params.billId,
          amountPaise: req.body.amountPaise != null ? Number(req.body.amountPaise) : null,
          mode: req.body.mode || 'cash',
          refNo: req.body.refNo || '',
        },
        req.user
      );
      return sendSuccess(res, result, 'Bill due settled successfully');
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },

  async markReminderSent(req, res, next) {
    try {
      const bill = await dueService.markReminderSent({
        billId: req.params.billId,
        stage: req.body.stage,
      });
      return sendSuccess(res, { bill }, 'Reminder marked as sent');
    } catch (err) {
      next(err);
    }
  },

  async voidOrDeleteBill(req, res, next) {
    try {
      const result = await billingService.voidOrDeleteBill(
        req.params.id,
        {
          reason: req.body?.reason || req.query?.reason || 'Created by mistake',
          permanentDelete: req.body?.permanentDelete === true || req.query?.permanentDelete === 'true',
        },
        req.user
      );
      return sendSuccess(
        res,
        result,
        result.deleted ? 'Bill deleted and inventory restored' : 'Bill voided and inventory restored'
      );
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },

  async editBill(req, res, next) {
    try {
      const result = await billingService.editBill(req.params.id, req.body, req.user);
      return sendSuccess(res, result, 'Bill updated successfully');
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },
};
