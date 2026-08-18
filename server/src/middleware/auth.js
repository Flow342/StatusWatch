import jwt from 'jsonwebtoken';
import config from '../config.js';
import { ApiError } from '../lib/errors.js';

export function signToken(payload) {
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn });
}

/** Rejects the request unless it carries a valid `Authorization: Bearer <token>` header. */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return next(new ApiError(401, 'Missing bearer token'));
  }

  try {
    req.user = jwt.verify(token, config.auth.jwtSecret);
    return next();
  } catch {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}
