import { Router } from 'express';
import { z } from 'zod';
import { userController } from '../controllers/user.controller.js';
import { authenticate, requireOwner } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const createUserSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  phone: z.string().min(10, 'Enter valid phone'),
  password: z.string().min(6, 'Password min 6 chars'),
  role: z.enum(['staff', 'owner']).default('staff'),
});

const resetPwSchema = z.object({ password: z.string().min(6, 'Password min 6 chars') });
const setPinSchema = z.object({ pin: z.string().length(4, 'PIN must be exactly 4 digits').regex(/^\d+$/, 'PIN must be digits') });

export const userRouter = Router();

// All user management is owner-only
userRouter.use(authenticate, requireOwner);

userRouter.get('/', userController.list);
userRouter.post('/', validateBody(createUserSchema), userController.create);
userRouter.patch('/:id/deactivate', userController.deactivate);
userRouter.patch('/:id/activate', userController.activate);
userRouter.patch('/:id/reset-password', validateBody(resetPwSchema), userController.resetPassword);
userRouter.patch('/:id/set-pin', validateBody(setPinSchema), userController.setPin);
