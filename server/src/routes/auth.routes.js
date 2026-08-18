import { Router } from 'express';
import bcrypt from 'bcryptjs';
import config from '../config.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

/**
 * There is exactly one admin, configured through the environment — no users table and
 * no signup endpoint. ADMIN_PASSWORD_HASH (bcrypt) is the supported production form;
 * ADMIN_PASSWORD is a plaintext convenience for local development only.
 */
async function verifyPassword(candidate) {
  if (config.auth.adminPasswordHash) {
    return bcrypt.compare(candidate, config.auth.adminPasswordHash);
  }
  // Constant-time-ish comparison via bcrypt on a throwaway hash is overkill here;
  // this branch only ever runs with a dev password from .env.
  return candidate === config.auth.adminPassword;
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};

    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new ApiError(400, 'username and password are required');
    }

    const usernameMatches = username === config.auth.adminUsername;
    const passwordMatches = await verifyPassword(password);

    if (!usernameMatches || !passwordMatches) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const token = signToken({ sub: config.auth.adminUsername, role: 'admin' });

    res.json({
      token,
      expires_in: config.auth.jwtExpiresIn,
      user: { username: config.auth.adminUsername, role: 'admin' },
    });
  }),
);

/** Lets the frontend confirm a stored token is still valid on page load. */
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: { username: req.user.sub, role: req.user.role } });
});

export default router;
