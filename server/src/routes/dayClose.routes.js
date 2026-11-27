import { Router } from 'express';
import { dayCloseController } from '../controllers/dayClose.controller.js';
import { authenticate } from '../middleware/auth.js';

export const dayCloseRouter = Router();

dayCloseRouter.use(authenticate);

dayCloseRouter.get('/summary', dayCloseController.getSummary);
dayCloseRouter.get('/history', dayCloseController.listHistory);
dayCloseRouter.post('/cash-entry', dayCloseController.addCashEntry);
dayCloseRouter.post('/close', dayCloseController.closeDay);
