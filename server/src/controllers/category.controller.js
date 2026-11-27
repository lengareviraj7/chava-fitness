import { sendSuccess } from '../utils/apiResponse.js';
import { categoryService } from '../services/category.service.js';

export const categoryController = {
  async list(req, res, next) {
    try {
      const categories = await categoryService.list();
      return sendSuccess(res, { categories });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const category = await categoryService.create(req.body);
      return sendSuccess(res, { category }, 'Category created', 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const category = await categoryService.update(req.params.id, req.body);
      return sendSuccess(res, { category }, 'Category updated');
    } catch (err) {
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await categoryService.delete(req.params.id);
      return sendSuccess(res, null, 'Category deactivated');
    } catch (err) {
      next(err);
    }
  },
};
