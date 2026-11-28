import { Router } from 'express';
import { billingController } from '../controllers/billing.controller.js';
import { authenticate } from '../middleware/auth.js';

export const billingRouter = Router();

billingRouter.use(authenticate);

billingRouter.post('/quote', billingController.getQuote);
billingRouter.post('/checkout', billingController.checkout);
billingRouter.get('/bills', billingController.listBills);
billingRouter.get('/bills/:id', billingController.getBillById);
billingRouter.post('/bills/:id/void', billingController.voidOrDeleteBill);
billingRouter.delete('/bills/:id', billingController.voidOrDeleteBill);
billingRouter.patch('/bills/:id', billingController.editBill);
billingRouter.get('/udhari', billingController.getUdhariList);
billingRouter.post('/udhari/:billId/settle', billingController.settleBillDue);
billingRouter.post('/udhari/:billId/remind', billingController.markReminderSent);
billingRouter.post('/hold', billingController.holdCart);
billingRouter.get('/hold', billingController.listHeld);
billingRouter.post('/hold/:holdCode/recall', billingController.recallHeld);
