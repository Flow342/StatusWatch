import { Router } from 'express';
import config from '../config.js';
import { verifyPassword } from '../lib/password.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

/**
 * There is exactly one admin, configured through the environment — no users table and
 * no signup endpoint. ADMIN_PASSWORD_HASH (bcrypt) is the supported production form;
 * ADMIN_PASSWORD is a plaintext convenience for local development only.
 */
const adminCredential = {
  hash: config.auth.adminPasswordHash,
  plaintext: config.auth.adminPassword,
};

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};

    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new ApiError(400, 'username and password are required');
    }

    const usernameMatches = username === config.auth.adminUsername;
    const passwordMatches = await verifyPassword(password, adminCredential);

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
