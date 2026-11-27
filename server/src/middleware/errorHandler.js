import { env } from '../config/env.js';

/**
 * Global Express error handler.
 * Catches anything next(err)'d or thrown inside async routes.
 */
export function errorHandler(err, req, res, _next) {
  console.error('[ERROR]', err.message, err.stack);


  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: { message: `Duplicate value for ${field}`, code: 'DUPLICATE_KEY' },
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details },
    });
  }

  // JWT
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' },
    });
  }

  const status = err.statusCode || err.status || 500;
  const errorPayload = {
    message: status < 500 ? err.message : 'Internal server error',
    code: err.code || 'SERVER_ERROR',
  };
  if (err.existingCustomer) {
    errorPayload.existingCustomer = err.existingCustomer;
  }
  if (err.existingProduct) {
    errorPayload.existingProduct = err.existingProduct;
  }
  if (err.similarProducts) {
    errorPayload.similarProducts = err.similarProducts;
  }
  return res.status(status).json({
    success: false,
    error: errorPayload,
  });
}
