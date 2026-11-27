import { Router } from 'express';
import { z } from 'zod';
import { categoryController } from '../controllers/category.controller.js';
import { authenticate, requireOwner } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const createSchema = z.object({
  name: z.string().min(1, 'Category name required'),
  description: z.string().optional(),
});

export const categoryRouter = Router();

categoryRouter.get('/', categoryController.list);
categoryRouter.post('/', authenticate, requireOwner, validateBody(createSchema), categoryController.create);
categoryRouter.put('/:id', authenticate, requireOwner, categoryController.update);
categoryRouter.delete('/:id', authenticate, requireOwner, categoryController.delete);
