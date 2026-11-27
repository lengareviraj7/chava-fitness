import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { authService } from '../services/auth.service.js';

export const authController = {
  async login(req, res, next) {
    try {
      const { phone, password } = req.body;
      const result = await authService.login(phone, password);
      // Set httpOnly cookie
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      return sendSuccess(res, { user: result.user }, 'Login successful');
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res) {
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
    return sendSuccess(res, null, 'Logged out');
  },

  async getMe(req, res) {
    return sendSuccess(res, { user: req.user });
  },
};
