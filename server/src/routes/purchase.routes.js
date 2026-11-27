import { Router } from 'express';
import { purchaseController } from '../controllers/purchase.controller.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

export const purchaseRouter = Router();

purchaseRouter.use(authenticate, requireOwner);

purchaseRouter.get('/', purchaseController.list);
purchaseRouter.get('/:id', purchaseController.getById);
purchaseRouter.post('/', purchaseController.create);
purchaseRouter.post('/:id/void', purchaseController.voidPurchase);
