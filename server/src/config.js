import 'dotenv/config';

/**
 * Central configuration. Every value comes from the environment so the app can be
 * containerised and deployed without code changes. Nothing here is hardcoded except
 * non-secret defaults that are safe in any environment.
 */

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy server/.env.example to server/.env and fill it in.`,
    );
  }
  return value;
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: int('PORT', 4000),
  host: process.env.HOST || '0.0.0.0',

  // Comma-separated list of allowed browser origins, or "*" for any.
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  db: {
    // DATABASE_URL wins when present (typical for managed Postgres / RDS).
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.PGHOST || 'localhost',
    port: int('PGPORT', 5432),
    database: process.env.PGDATABASE || 'statuswatch',
    user: process.env.PGUSER || undefined,
    password: process.env.PGPASSWORD || undefined,
    ssl: bool('PGSSL', false) ? { rejectUnauthorized: false } : false,
    maxPoolSize: int('PG_POOL_MAX', 10),
  },

  auth: {
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    // Preferred: a bcrypt hash (see `npm run hash-password`).
    adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || null,
    // Dev-only fallback so a fresh clone runs without generating a hash first.
    adminPassword: process.env.ADMIN_PASSWORD || null,
  },

  scheduler: {
    enabled: bool('SCHEDULER_ENABLED', true),
    // 6-field cron (with seconds). Every 30s the scheduler looks for services that are due.
    cron: process.env.SCHEDULER_CRON || '*/30 * * * * *',
    // Per-request timeout when probing a monitored URL.
    timeoutMs: int('CHECK_TIMEOUT_MS', 10000),
    // How many services may be probed concurrently in one tick.
    concurrency: int('CHECK_CONCURRENCY', 5),
    userAgent: process.env.CHECK_USER_AGENT || 'StatusWatch/1.0 (+uptime-monitor)',
  },
};

if (!config.auth.adminPasswordHash && !config.auth.adminPassword) {
  throw new Error(
    'Missing admin credentials: set ADMIN_PASSWORD_HASH (recommended) or ADMIN_PASSWORD.',
  );
}

export default config;
