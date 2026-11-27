import { User } from '../models/User.js';

export const userService = {
  async list() {
    return User.find({}).select('-password -pin').sort({ createdAt: 1 });
  },

  async create({ name, phone, password, role = 'staff' }) {
    const existing = await User.findOne({ phone });
    if (existing) {
      const err = new Error('A user with this phone number already exists');
      err.statusCode = 409;
      throw err;
    }
    const user = await User.create({ name, phone, password, role });
    const { password: _pw, pin: _pin, ...safe } = user.toObject();
    return safe;
  },

  async deactivate(id) {
    const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true }).select('-password -pin');
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return user;
  },

  async activate(id) {
    const user = await User.findByIdAndUpdate(id, { isActive: true }, { new: true }).select('-password -pin');
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return user;
  },

  async resetPassword(id, newPassword) {
    const user = await User.findById(id);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    user.password = newPassword;
    await user.save();
    return { ok: true };
  },

  async setPin(id, pin) {
    const user = await User.findById(id);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    user.pin = pin;
    await user.save();
    return { ok: true };
  },
};
