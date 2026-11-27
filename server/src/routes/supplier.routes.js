import { Router } from 'express';
import { z } from 'zod';
import { supplierController } from '../controllers/supplier.controller.js';
import { authenticate, requireOwner } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name required'),
  phone: z.string().min(10, 'Valid phone required'),
  gstin: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const supplierRouter = Router();

supplierRouter.use(authenticate, requireOwner);

supplierRouter.get('/', supplierController.list);
supplierRouter.get('/:id', supplierController.getById);
supplierRouter.get('/:id/summary', supplierController.getSummary);
supplierRouter.post('/', validateBody(createSupplierSchema), supplierController.create);
supplierRouter.put('/:id', supplierController.update);
supplierRouter.post('/payments', supplierController.recordPayment);
