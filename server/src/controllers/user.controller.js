import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { userService } from '../services/user.service.js';

export const userController = {
  async list(req, res, next) {
    try {
      const users = await userService.list();
      return sendSuccess(res, { users });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const user = await userService.create(req.body);
      return sendSuccess(res, { user }, 'Staff user created', 201);
    } catch (err) {
      next(err);
    }
  },

  async deactivate(req, res, next) {
    try {
      const user = await userService.deactivate(req.params.id);
      return sendSuccess(res, { user }, 'User deactivated');
    } catch (err) {
      next(err);
    }
  },

  async activate(req, res, next) {
    try {
      const user = await userService.activate(req.params.id);
      return sendSuccess(res, { user }, 'User activated');
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req, res, next) {
    try {
      await userService.resetPassword(req.params.id, req.body.password);
      return sendSuccess(res, null, 'Password reset successfully');
    } catch (err) {
      next(err);
    }
  },

  async setPin(req, res, next) {
    try {
      await userService.setPin(req.params.id, req.body.pin);
      return sendSuccess(res, null, 'PIN set successfully');
    } catch (err) {
      next(err);
    }
  },
};
