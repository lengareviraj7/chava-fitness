import { Category } from '../models/Category.js';

export const categoryService = {
  async list() {
    return Category.find({ isActive: true }).sort({ name: 1 });
  },

  async create({ name, description }) {
    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      const err = new Error('Category already exists');
      err.statusCode = 409;
      throw err;
    }
    return Category.create({ name: name.trim(), description });
  },

  async update(id, data) {
    const cat = await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!cat) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }
    return cat;
  },

  async delete(id) {
    const cat = await Category.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!cat) {
      const err = new Error('Category not found');
      err.statusCode = 404;
      throw err;
    }
    return cat;
  },
};
