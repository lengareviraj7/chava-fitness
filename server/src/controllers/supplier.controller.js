import { sendSuccess } from '../utils/apiResponse.js';
import { supplierService } from '../services/supplier.service.js';

export const supplierController = {
  async list(req, res, next) {
    try {
      const suppliers = await supplierService.list(req.query);
      return sendSuccess(res, { suppliers });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const supplier = await supplierService.getById(req.params.id);
      return sendSuccess(res, { supplier });
    } catch (err) {
      next(err);
    }
  },

  async getSummary(req, res, next) {
    try {
      const summary = await supplierService.getSummary(req.params.id);
      return sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const supplier = await supplierService.create(req.body);
      return sendSuccess(res, { supplier }, 'Supplier created', 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body);
      return sendSuccess(res, { supplier }, 'Supplier updated');
    } catch (err) {
      next(err);
    }
  },

  async recordPayment(req, res, next) {
    try {
      const result = await supplierService.recordPayment({
        ...req.body,
        userId: req.user._id,
      });
      return sendSuccess(res, result, 'Payment recorded', 201);
    } catch (err) {
      next(err);
    }
  },
};
