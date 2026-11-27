import { productService } from '../services/product.service.js';
import { Category } from '../models/Category.js';
import { Brand } from '../models/Brand.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const productController = {
  async list(req, res) {
    try {
      const userRole = req.user?.role || 'staff';
      const result = await productService.list({
        ...req.query,
        userRole,
      });
      return sendSuccess(res, result);
    } catch (error) {
      return sendError(res, error.message);
    }
  },

  async getById(req, res) {
    try {
      const userRole = req.user?.role || 'staff';
      const product = await productService.getById(req.params.id, userRole);
      if (!product) {
        return sendError(res, 'Product not found', 'NOT_FOUND', 404);
      }
      return sendSuccess(res, product);
    } catch (error) {
      return sendError(res, error.message);
    }
  },

  async getSimilar(req, res) {
    try {
      const { name, brand, categoryId } = req.query;
      const products = await productService.findSimilar({ name, brand, categoryId });
      return sendSuccess(res, { products });
    } catch (error) {
      return sendError(res, error.message);
    }
  },

  async create(req, res) {
    try {
      const product = await productService.create(req.body);
      return sendSuccess(res, product, 201);
    } catch (error) {
      return sendError(res, error.message, 'VALIDATION_ERROR', 400);
    }
  },

  async update(req, res) {
    try {
      const updated = await productService.update(req.params.id, req.body);
      if (!updated) {
        return sendError(res, 'Product not found', 'NOT_FOUND', 404);
      }
      return sendSuccess(res, updated);
    } catch (error) {
      return sendError(res, error.message, 'VALIDATION_ERROR', 400);
    }
  },

  async toggleActive(req, res) {
    try {
      const product = await productService.toggleActive(req.params.id);
      if (!product) {
        return sendError(res, 'Product not found', 'NOT_FOUND', 404);
      }
      return sendSuccess(res, product);
    } catch (error) {
      return sendError(res, error.message);
    }
  },

  async getSimilar(req, res) {
    try {
      const { name, brand, categoryId } = req.query;
      const products = await productService.findSimilar({ name, brand, categoryId });
      return sendSuccess(res, { products });
    } catch (error) {
      return sendError(res, error.message);
    }
  },

  async delete(req, res) {
    try {
      const deleted = await productService.delete(req.params.id);
      if (!deleted) {
        return sendError(res, 'Product not found', 'NOT_FOUND', 404);
      }
      return sendSuccess(res, { message: 'Product deactivated successfully' });
    } catch (error) {
      return sendError(res, error.message);
    }
  },
};

export const categoryController = {
  async list(req, res) {
    try {
      const categories = await Category.find({ isActive: true }).sort({ name: 1 });
      return sendSuccess(res, categories);
    } catch (error) {
      return sendError(res, error.message);
    }
  },

  async create(req, res) {
    try {
      const { name, description } = req.body;
      const category = await Category.create({ name, description });
      return sendSuccess(res, category, 201);
    } catch (error) {
      return sendError(res, error.message, 'VALIDATION_ERROR', 400);
    }
  },
};

export const brandController = {
  async list(req, res) {
    try {
      const brands = await Brand.find({ isActive: true }).sort({ name: 1 });
      return sendSuccess(res, brands);
    } catch (error) {
      return sendError(res, error.message);
    }
  },
};
