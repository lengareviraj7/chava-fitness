import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { JWT_EXPIRY } from '../config/constants.js';

export const authService = {
  async login(phone, password) {
    if (!phone || !password) {
      const err = new Error('Phone and password are required');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user || !user.isActive) {
      const err = new Error('Invalid phone or password');
      err.statusCode = 401;
      throw err;
    }

    const match = await user.comparePassword(password);
    if (!match) {
      const err = new Error('Invalid phone or password');
      err.statusCode = 401;
      throw err;
    }

    const token = jwt.sign({ id: user._id, role: user.role }, env.JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });

    return {
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  },
};
