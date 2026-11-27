import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';

export const reportRouter = Router();

reportRouter.use(authenticate);

reportRouter.get('/sales', reportController.getSales);
reportRouter.get('/gstr-1', reportController.getGstr1);
reportRouter.get('/stock-valuation', reportController.getStockValuation);
reportRouter.get('/profit-loss', reportController.getProfitLoss);
reportRouter.get('/dues-aging', reportController.getDuesAging);
reportRouter.get('/fast-slow-moving', reportController.getFastSlowMoving);
