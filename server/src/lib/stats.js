import { query } from '../db/pool.js';

/**
 * Analytical queries over the `checks` table: uptime percentages, response-time
 * averages, the 24h timeline the dashboard charts, and derived incident history.
 */

export const WINDOWS = ['24h', '7d', '30d'];

const WINDOW_INTERVALS = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

function uptimePercent(up, total) {
  if (!total) return null; // no data yet — the UI shows "—" rather than a misleading 0%
  return Math.round((up / total) * 10000) / 100;
}

/**
 * Uptime %, check counts and average response time for all three windows,
 * computed in a single pass over the last 30 days of checks.
 */
export async function getUptimeWindows(serviceId) {
  const selects = WINDOWS.flatMap((window) => {
    const interval = WINDOW_INTERVALS[window];
    const recent = `checked_at >= NOW() - INTERVAL '${interval}'`;
    return [
      `COUNT(*) FILTER (WHERE ${recent}) AS total_${window}`,
      `COUNT(*) FILTER (WHERE ${recent} AND status = 'up') AS up_${window}`,
      `AVG(response_time_ms) FILTER (WHERE ${recent} AND status = 'up') AS avg_${window}`,
    ];
  });

  const { rows } = await query(
    `SELECT ${selects.join(', ')}
     FROM checks
     WHERE service_id = $1 AND checked_at >= NOW() - INTERVAL '30 days'`,
    [serviceId],
  );

  const row = rows[0];
  return Object.fromEntries(
    WINDOWS.map((window) => {
      const total = row[`total_${window}`] ?? 0;
      const up = row[`up_${window}`] ?? 0;
      const avg = row[`avg_${window}`];
      return [
        window,
        {
          total_checks: total,
          up_checks: up,
          down_checks: total - up,
          uptime_percent: uptimePercent(up, total),
          avg_response_time_ms: avg === null || avg === undefined ? null : Math.round(avg),
        },
      ];
    }),
  );
}

/**
 * Hourly buckets covering the last 24 hours, gap-filled via generate_series so the
 * chart keeps a continuous x-axis even for hours with no checks.
 */
export async function getTimeline24h(serviceId) {
  const { rows } = await query(
    `WITH buckets AS (
       SELECT generate_series(
         date_trunc('hour', NOW()) - INTERVAL '23 hours',
         date_trunc('hour', NOW()),
         INTERVAL '1 hour'
       ) AS bucket
     )
     SELECT
       b.bucket,
       COUNT(c.id) AS total,
       COUNT(c.id) FILTER (WHERE c.status = 'up') AS up,
       AVG(c.response_time_ms) FILTER (WHERE c.status = 'up') AS avg_response_time_ms
     FROM buckets b
     LEFT JOIN checks c
       ON c.service_id = $1
      AND c.checked_at >= b.bucket
      AND c.checked_at < b.bucket + INTERVAL '1 hour'
     GROUP BY b.bucket
     ORDER BY b.bucket`,
    [serviceId],
  );

  return rows.map((row) => {
    let status = 'unknown';
    if (row.total > 0) {
      if (row.up === row.total) status = 'up';
      else if (row.up === 0) status = 'down';
      else status = 'degraded';
    }

    return {
      bucket: row.bucket,
      total_checks: row.total,
      up_checks: row.up,
      status,
      uptime_percent: uptimePercent(row.up, row.total),
      avg_response_time_ms:
        row.avg_response_time_ms === null ? null : Math.round(row.avg_response_time_ms),
    };
  });
}

/**
 * Folds the raw check stream into incidents: an incident is an unbroken run of `down`
 * checks. It stays "ongoing" until an `up` check closes it.
 */
export async function getIncidents(serviceId, { days = 30, limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT status, http_code, checked_at
     FROM checks
     WHERE service_id = $1 AND checked_at >= NOW() - make_interval(days => $2)
     ORDER BY checked_at ASC`,
    [serviceId, days],
  );

  const incidents = [];
  let current = null;

  for (const check of rows) {
    if (check.status === 'down') {
      if (!current) {
        current = {
          started_at: check.checked_at,
          last_down_at: check.checked_at,
          resolved_at: null,
          failed_checks: 0,
          http_codes: [],
        };
      }
      current.last_down_at = check.checked_at;
      current.failed_checks += 1;
      const code = check.http_code === null ? 'connection_error' : check.http_code;
      if (!current.http_codes.includes(code)) current.http_codes.push(code);
    } else if (current) {
      current.resolved_at = check.checked_at;
      incidents.push(current);
      current = null;
    }
  }

  if (current) incidents.push(current); // still failing as of the latest check

  return incidents
    .map((incident) => ({
      ...incident,
      ongoing: incident.resolved_at === null,
      duration_seconds: Math.max(
        0,
        Math.round(
          (new Date(incident.resolved_at ?? incident.last_down_at).getTime() -
            new Date(incident.started_at).getTime()) /
            1000,
        ),
      ),
    }))
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    .slice(0, limit);
}

/** The most recent checks, newest first — powers the response-time sparkline. */
export async function getRecentChecks(serviceId, limit = 100) {
  const { rows } = await query(
    `SELECT id, service_id, status, http_code, response_time_ms, checked_at
     FROM checks
     WHERE service_id = $1
     ORDER BY checked_at DESC
     LIMIT $2`,
    [serviceId, limit],
  );
  return rows;
}
