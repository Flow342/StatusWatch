import pool from './pool.js';
import { reportFatalDbError } from '../lib/db-error.js';

/**
 * Seeds 4 example services and backfills 30 days of synthetic check history so the
 * dashboard has something to draw before the scheduler has run for a month.
 *
 *   npm run seed            # insert services that don't exist yet, backfill history
 *   npm run seed -- --fresh # wipe services + checks first
 */

const SERVICES = [
  {
    name: 'Anthropic',
    url: 'https://www.anthropic.com',
    interval_seconds: 300,
    // Synthetic-history profile: how the backfill should look.
    profile: { baseMs: 120, jitterMs: 60, downtimeRate: 0.002 },
  },
  {
    name: 'GitHub API',
    url: 'https://api.github.com',
    interval_seconds: 120,
    profile: { baseMs: 220, jitterMs: 90, downtimeRate: 0.004 },
  },
  {
    name: 'Example Corp Website',
    url: 'https://example.com',
    interval_seconds: 600,
    profile: { baseMs: 340, jitterMs: 180, downtimeRate: 0.01 },
  },
  {
    name: 'Flaky Internal Service',
    // Resolves to nothing — a reliably "down" service to exercise the red state.
    url: 'https://service-that-does-not-exist.statuswatch.invalid/health',
    interval_seconds: 300,
    profile: { baseMs: 0, jitterMs: 0, downtimeRate: 1 },
  },
];

const BACKFILL_DAYS = 30;
const MIN_BACKFILL_SPACING_SECONDS = 600; // keep the synthetic history to a sane row count

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/** Builds one service's synthetic history as rows ready for a bulk INSERT. */
function buildHistory(serviceId, { interval_seconds, profile }) {
  const spacing = Math.max(interval_seconds, MIN_BACKFILL_SPACING_SECONDS) * 1000;
  const now = Date.now();
  const start = now - BACKFILL_DAYS * 24 * 60 * 60 * 1000;
  const rows = [];

  // Outage state persists across a few consecutive checks, the way real incidents do.
  let outageRemaining = 0;

  for (let t = start; t <= now; t += spacing) {
    if (outageRemaining > 0) {
      outageRemaining -= 1;
    } else if (Math.random() < profile.downtimeRate) {
      outageRemaining = Math.ceil(randomBetween(1, 5));
    }

    const isDown = outageRemaining > 0 || profile.downtimeRate >= 1;

    if (isDown) {
      // Half the outages are HTTP errors, half are connection failures (no code at all).
      const httpCode = Math.random() < 0.5 ? (Math.random() < 0.5 ? 500 : 503) : null;
      rows.push([
        serviceId,
        'down',
        httpCode,
        httpCode ? Math.round(randomBetween(200, 900)) : null,
        new Date(t).toISOString(),
      ]);
    } else {
      // Slight daily traffic curve: slower around midday UTC.
      const hour = new Date(t).getUTCHours();
      const dayFactor = 1 + 0.35 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
      const responseTime = Math.round(
        profile.baseMs * dayFactor + randomBetween(0, profile.jitterMs),
      );
      rows.push([serviceId, 'up', 200, responseTime, new Date(t).toISOString()]);
    }
  }

  return rows;
}

/** Inserts rows in chunks so we never build a single multi-megabyte statement. */
async function bulkInsertChecks(client, rows, chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = [];
    const placeholders = chunk.map((row, index) => {
      const base = index * 5;
      values.push(...row);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });
    await client.query(
      `INSERT INTO checks (service_id, status, http_code, response_time_ms, checked_at)
       VALUES ${placeholders.join(', ')}`,
      values,
    );
  }
}

async function seed() {
  const fresh = process.argv.includes('--fresh');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (fresh) {
      // checks cascade from services, but be explicit about what is being destroyed.
      await client.query('TRUNCATE checks, services RESTART IDENTITY CASCADE');
      console.log('[seed] cleared existing services and checks');
    }

    for (const service of SERVICES) {
      const existing = await client.query('SELECT id FROM services WHERE url = $1', [service.url]);
      if (existing.rowCount > 0) {
        console.log(`[seed] skipping "${service.name}" — already present`);
        continue;
      }

      const inserted = await client.query(
        `INSERT INTO services (name, url, interval_seconds)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [service.name, service.url, service.interval_seconds],
      );
      const serviceId = inserted.rows[0].id;

      const history = buildHistory(serviceId, service);
      await bulkInsertChecks(client, history);

      console.log(`[seed] "${service.name}" + ${history.length} historical checks`);
    }

    await client.query('COMMIT');
    console.log('[seed] done');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .catch(async (err) => {
    reportFatalDbError('seed', err);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
