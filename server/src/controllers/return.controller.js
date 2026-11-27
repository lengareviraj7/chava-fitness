import { returnService } from '../services/billing/return.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const returnController = {
  async preview(req, res, next) {
    try {
      const { billId, returnLines } = req.body;
      const result = await returnService.previewReturn({ billId, returnLines });
      return sendSuccess(res, result);
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const { billId, returnLines, settlement, reason, note, ownerPin } = req.body;
      const creditNote = await returnService.createReturn({
        billId,
        returnLines,
        settlement,
        reason,
        note,
        userId: req.user._id,
        ownerPin,
      });
      return sendSuccess(res, { creditNote }, 'Return processed successfully', 201);
    } catch (err) {
      if (!err.statusCode) err.statusCode = 400;
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await returnService.listCreditNotes({ page, limit });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const creditNote = await returnService.getCreditNoteById(req.params.id);
      return sendSuccess(res, { creditNote });
    } catch (err) {
      next(err);
    }
  },
};
