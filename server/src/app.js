import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';

import { authRouter } from './routes/auth.routes.js';
import { productRouter } from './routes/product.routes.js';
import { userRouter } from './routes/user.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { categoryRouter } from './routes/category.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { supplierRouter } from './routes/supplier.routes.js';
import { purchaseRouter } from './routes/purchase.routes.js';
import { stockRouter } from './routes/stock.routes.js';
import { billingRouter } from './routes/billing.routes.js';
import { customerRouter } from './routes/customer.routes.js';
import { returnRouter } from './routes/return.routes.js';
import { dayCloseRouter } from './routes/dayClose.routes.js';
import { reportRouter } from './routes/report.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security headers
app.use(helmet());

// CORS — allow client origin with credentials
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/v1/products', productRouter);
app.use('/api/users', userRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/v1/categories', categoryRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/suppliers', supplierRouter);
app.use('/api/v1/suppliers', supplierRouter);
app.use('/api/purchases', purchaseRouter);
app.use('/api/v1/purchases', purchaseRouter);
app.use('/api/stock', stockRouter);
app.use('/api/v1/stock', stockRouter);
app.use('/api/billing', billingRouter);
app.use('/api/v1/billing', billingRouter);
app.use('/api/customers', customerRouter);
app.use('/api/v1/customers', customerRouter);
app.use('/api/returns', returnRouter);
app.use('/api/v1/returns', returnRouter);
app.use('/api/day-close', dayCloseRouter);
app.use('/api/v1/day-close', dayCloseRouter);
app.use('/api/reports', reportRouter);
app.use('/api/v1/reports', reportRouter);
app.use('/api/search', searchRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/v1/notifications', notificationRouter);

// 404
app.use((_req, res) =>
  res.status(404).json({ success: false, error: { message: 'Route not found', code: 'NOT_FOUND' } })
);

// Global error handler
app.use(errorHandler);

export default app;
