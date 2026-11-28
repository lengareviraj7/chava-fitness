import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { notificationController } from '../controllers/notification.controller.js';

export const notificationRouter = Router();

notificationRouter.use(authenticate);
notificationRouter.get('/', notificationController.getNotifications);
