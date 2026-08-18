import config from '../config.js';
import { ApiError } from '../lib/errors.js';

export function notFound(_req, _res, next) {
  next(new ApiError(404, 'Route not found'));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export function errorHandler(err, _req, res, _next) {
  const status = err instanceof ApiError ? err.status : 500;

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    error: {
      message: status >= 500 && config.env === 'production' ? 'Internal server error' : err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
