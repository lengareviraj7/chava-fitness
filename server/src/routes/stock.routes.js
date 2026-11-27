import { Router } from 'express';
import { stockController } from '../controllers/stock.controller.js';
import { authenticate, requireOwner } from '../middleware/auth.js';

export const stockRouter = Router();

stockRouter.use(authenticate);

stockRouter.get('/', stockController.list);
stockRouter.get('/alerts', stockController.getAlerts);
stockRouter.get('/variants/:variantId', stockController.getVariantStock);
stockRouter.post('/adjustments', requireOwner, stockController.adjustStock);
