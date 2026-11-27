import { Router } from 'express';
import { customerController } from '../controllers/customer.controller.js';
import { authenticate } from '../middleware/auth.js';

export const customerRouter = Router();

customerRouter.use(authenticate);

customerRouter.get('/', customerController.list);
customerRouter.post('/', customerController.create);
customerRouter.get('/reminders', customerController.getReminders);
customerRouter.post('/:id/reminders/sent', customerController.markReminderSent);
customerRouter.get('/:id', customerController.getById);
customerRouter.put('/:id', customerController.update);
customerRouter.get('/:id/ledger', customerController.getLedger);
customerRouter.post('/:id/collect-due', customerController.collectDue);
