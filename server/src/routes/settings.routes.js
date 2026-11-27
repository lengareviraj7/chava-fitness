import { Router } from 'express';
import { z } from 'zod';
import { settingsController } from '../controllers/settings.controller.js';
import { authenticate, requireOwner } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const updateSchema = z.object({
  shopName: z.string().min(1).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstin: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  billPrefix: z.string().max(5).optional(),
  upiId: z.string().optional(),
  footerNote: z.string().optional(),
});

export const settingsRouter = Router();

settingsRouter.get('/', authenticate, settingsController.get);
settingsRouter.put('/', authenticate, requireOwner, validateBody(updateSchema), settingsController.update);
