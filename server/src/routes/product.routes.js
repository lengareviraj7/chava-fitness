import { Router } from 'express';
import { productController, categoryController, brandController } from '../controllers/product.controller.js';
import { optionalAuth, authenticate, requireOwner } from '../middleware/auth.js';

export const productRouter = Router();

// Brands
productRouter.get('/brands', brandController.list);

// Products
productRouter.get('/', optionalAuth, productController.list);
productRouter.get('/:id', optionalAuth, productController.getById);
productRouter.post('/', authenticate, requireOwner, productController.create);
productRouter.put('/:id', authenticate, requireOwner, productController.update);
productRouter.patch('/:id/toggle-active', authenticate, requireOwner, productController.toggleActive);
productRouter.delete('/:id', authenticate, requireOwner, productController.delete);

