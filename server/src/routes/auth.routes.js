import { Router } from 'express';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: process.env.NODE_ENV === 'production' ? 10 : 500,
  message: { success: false, error: { message: 'Too many login attempts. Try again in 15 minutes.', code: 'RATE_LIMIT' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  phone: z.string().min(10, 'Enter a valid phone number'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validateBody(loginSchema), authController.login);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authenticate, authController.getMe);
