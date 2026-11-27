import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { settingsService } from '../services/settings.service.js';

export const settingsController = {
  async get(req, res, next) {
    try {
      const settings = await settingsService.get();
      return sendSuccess(res, { settings });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const settings = await settingsService.update(req.body);
      return sendSuccess(res, { settings }, 'Settings updated');
    } catch (err) {
      next(err);
    }
  },
};
