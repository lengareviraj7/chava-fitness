import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { searchController } from '../controllers/search.controller.js';

export const searchRouter = Router();

searchRouter.use(authenticate);
searchRouter.get('/', searchController.search);
