import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config.js';
import { query } from './db/pool.js';
import { asyncHandler } from './lib/errors.js';
import { describeDbError } from './lib/db-error.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import serviceRoutes from './routes/services.routes.js';

export function createApp() {
  const app = express();

  // Correct client IPs and protocol when running behind an ALB / reverse proxy.
  app.set('trust proxy', true);
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  if (config.env !== 'test') {
    app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  }

  // Liveness/readiness probe: reports the database round trip too.
  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      try {
        await query('SELECT 1');
        res.json({ status: 'ok', database: 'ok', uptime_seconds: Math.round(process.uptime()) });
      } catch (err) {
        res
          .status(503)
          .json({ status: 'degraded', database: 'unreachable', error: describeDbError(err) });
      }
    }),
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/services', serviceRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
