import { customerService } from '../services/customer.service.js';
import { dueService } from '../services/billing/due.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const customerController = {
  async lookup(req, res, next) {
    try {
      const { q } = req.query;
      const customers = await customerService.lookup(q);
      return sendSuccess(res, { customers });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const { search, hasDues, page, limit } = req.query;
      const result = await customerService.list({
        search,
        hasDues: hasDues === 'true',
        page,
        limit,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const customer = await customerService.getById(req.params.id);
      return sendSuccess(res, { customer });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const customer = await customerService.create(req.body);
      return sendSuccess(res, { customer }, 'Customer created', 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const customer = await customerService.update(req.params.id, req.body);
      return sendSuccess(res, { customer }, 'Customer updated');
    } catch (err) {
      next(err);
    }
  },

  async getLedger(req, res, next) {
    try {
      const result = await customerService.getLedger(req.params.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async collectDue(req, res, next) {
    try {
      const { amountPaise, mode, refNo } = req.body;
      const result = await dueService.collectDue(
        {
          customerId: req.params.id,
          amountPaise: Number(amountPaise),
          mode,
          refNo,
        },
        req.user
      );
      return sendSuccess(res, result, 'Due collected successfully');
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },

  async getReminders(req, res, next) {
    try {
      const reminders = await customerService.getRefillReminders();
      return sendSuccess(res, { reminders });
    } catch (err) {
      next(err);
    }
  },

  async markReminderSent(req, res, next) {
    try {
      const customer = await customerService.markReminderSent(req.params.id);
      return sendSuccess(res, { customer }, 'Reminder marked as sent');
    } catch (err) {
      next(err);
    }
  },
};
