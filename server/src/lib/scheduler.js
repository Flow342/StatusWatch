import cron from 'node-cron';
import config from '../config.js';
import { query } from '../db/pool.js';
import { runCheck } from './checker.js';

/**
 * A single cron job drives all monitoring. Rather than creating one cron task per
 * service (which would need re-wiring whenever a service is added, removed or has its
 * interval changed), the job ticks frequently and asks the database which services are
 * due — i.e. whose most recent check is older than their own `interval_seconds`.
 */

let task = null;
let ticking = false;

const DUE_SERVICES_SQL = `
  SELECT s.id, s.name, s.url, s.interval_seconds, last.checked_at AS last_checked_at
  FROM services s
  LEFT JOIN LATERAL (
    SELECT c.checked_at
    FROM checks c
    WHERE c.service_id = s.id
    ORDER BY c.checked_at DESC
    LIMIT 1
  ) last ON TRUE
  WHERE last.checked_at IS NULL
     OR last.checked_at <= NOW() - make_interval(secs => s.interval_seconds)
  ORDER BY last.checked_at ASC NULLS FIRST
`;

/** Runs `worker` over `items`, keeping at most `limit` probes in flight at once. */
async function mapWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function tick() {
  // A slow batch must not overlap with the next cron firing.
  if (ticking) return { skipped: true, checked: 0 };
  ticking = true;

  try {
    const { rows: due } = await query(DUE_SERVICES_SQL);
    if (due.length === 0) return { skipped: false, checked: 0 };

    await mapWithConcurrency(due, config.scheduler.concurrency, async (service) => {
      try {
        const check = await runCheck(service);
        console.log(
          `[scheduler] ${service.name} → ${check.status}` +
            ` (${check.http_code ?? 'no response'}, ${check.response_time_ms}ms)`,
        );
      } catch (err) {
        // A DB failure while recording one service must not abort the whole batch.
        console.error(`[scheduler] failed to record check for "${service.name}":`, err.message);
      }
    });

    return { skipped: false, checked: due.length };
  } catch (err) {
    console.error('[scheduler] tick failed:', err.message);
    return { skipped: false, checked: 0, error: err.message };
  } finally {
    ticking = false;
  }
}

export function startScheduler() {
  if (!config.scheduler.enabled) {
    console.log('[scheduler] disabled via SCHEDULER_ENABLED=false');
    return null;
  }
  if (task) return task;

  task = cron.schedule(config.scheduler.cron, tick);
  console.log(`[scheduler] started with cron "${config.scheduler.cron}"`);

  // Catch up immediately on boot instead of waiting for the first tick.
  tick();

  return task;
}

export async function stopScheduler() {
  if (!task) return;
  await task.stop();
  task = null;
}
