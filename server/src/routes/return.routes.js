import { Router } from 'express';
import { returnController } from '../controllers/return.controller.js';
import { authenticate } from '../middleware/auth.js';

export const returnRouter = Router();

returnRouter.use(authenticate);

returnRouter.get('/', returnController.list);
returnRouter.post('/preview', returnController.preview);
returnRouter.post('/', returnController.create);
returnRouter.get('/:id', returnController.getById);
