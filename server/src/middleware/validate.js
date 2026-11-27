import { ZodError } from 'zod';

/**
 * Returns Express middleware that validates req.body against a Zod schema.
 * On failure returns 400 with structured errors.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ success: false, error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: errors } });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
      return res.status(400).json({ success: false, error: { message: 'Invalid query params', code: 'VALIDATION_ERROR', details: errors } });
    }
    req.query = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
      return res.status(400).json({ success: false, error: { message: 'Invalid URL params', code: 'VALIDATION_ERROR', details: errors } });
    }
    req.params = result.data;
    next();
  };
}
