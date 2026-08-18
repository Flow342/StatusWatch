import { Router } from 'express';
import { query } from '../db/pool.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { runCheck } from '../lib/checker.js';
import { getIncidents, getRecentChecks, getTimeline24h, getUptimeWindows } from '../lib/stats.js';
import { parseId, validateServicePayload } from '../lib/validation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const SERVICE_COLUMNS = 's.id, s.name, s.url, s.interval_seconds, s.created_at';

/**
 * One query returns everything the dashboard needs per service: the row itself, its
 * latest check, uptime aggregates for all three windows, and the last 24 response
 * times for the sparkline. LATERAL joins keep it to a single round trip.
 */
const SERVICE_LIST_SQL = `
  SELECT
    ${SERVICE_COLUMNS},
    latest.status            AS last_status,
    latest.http_code         AS last_http_code,
    latest.response_time_ms  AS last_response_time_ms,
    latest.checked_at        AS last_checked_at,
    agg.total_24h, agg.up_24h, agg.avg_24h,
    agg.total_7d,  agg.up_7d,  agg.avg_7d,
    agg.total_30d, agg.up_30d, agg.avg_30d,
    spark.points             AS sparkline
  FROM services s
  LEFT JOIN LATERAL (
    SELECT c.status, c.http_code, c.response_time_ms, c.checked_at
    FROM checks c
    WHERE c.service_id = s.id
    ORDER BY c.checked_at DESC
    LIMIT 1
  ) latest ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE c.checked_at >= NOW() - INTERVAL '24 hours')                       AS total_24h,
      COUNT(*) FILTER (WHERE c.checked_at >= NOW() - INTERVAL '24 hours' AND c.status = 'up')   AS up_24h,
      AVG(c.response_time_ms) FILTER (WHERE c.checked_at >= NOW() - INTERVAL '24 hours' AND c.status = 'up') AS avg_24h,
      COUNT(*) FILTER (WHERE c.checked_at >= NOW() - INTERVAL '7 days')                         AS total_7d,
      COUNT(*) FILTER (WHERE c.checked_at >= NOW() - INTERVAL '7 days' AND c.status = 'up')     AS up_7d,
      AVG(c.response_time_ms) FILTER (WHERE c.checked_at >= NOW() - INTERVAL '7 days' AND c.status = 'up')   AS avg_7d,
      COUNT(*)                                                                                  AS total_30d,
      COUNT(*) FILTER (WHERE c.status = 'up')                                                   AS up_30d,
      AVG(c.response_time_ms) FILTER (WHERE c.status = 'up')                                     AS avg_30d
    FROM checks c
    WHERE c.service_id = s.id AND c.checked_at >= NOW() - INTERVAL '30 days'
  ) agg ON TRUE
  LEFT JOIN LATERAL (
    SELECT array_agg(t.response_time_ms ORDER BY t.checked_at) AS points
    FROM (
      SELECT c.response_time_ms, c.checked_at
      FROM checks c
      WHERE c.service_id = s.id AND c.status = 'up' AND c.response_time_ms IS NOT NULL
      ORDER BY c.checked_at DESC
      LIMIT 24
    ) t
  ) spark ON TRUE
`;

function uptimePercent(up, total) {
  if (!total) return null;
  return Math.round((up / total) * 10000) / 100;
}

function round(value) {
  return value === null || value === undefined ? null : Math.round(value);
}

function toServiceSummary(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    interval_seconds: row.interval_seconds,
    created_at: row.created_at,
    // "unknown" until the scheduler has recorded at least one check.
    current_status: row.last_status ?? 'unknown',
    last_check: row.last_checked_at
      ? {
          status: row.last_status,
          http_code: row.last_http_code,
          response_time_ms: row.last_response_time_ms,
          checked_at: row.last_checked_at,
        }
      : null,
    uptime: {
      '24h': uptimePercent(row.up_24h, row.total_24h),
      '7d': uptimePercent(row.up_7d, row.total_7d),
      '30d': uptimePercent(row.up_30d, row.total_30d),
    },
    avg_response_time_ms: {
      '24h': round(row.avg_24h),
      '7d': round(row.avg_7d),
      '30d': round(row.avg_30d),
    },
    sparkline: row.sparkline ?? [],
  };
}

async function findServiceOr404(id) {
  const { rows } = await query(
    'SELECT id, name, url, interval_seconds, created_at FROM services WHERE id = $1',
    [id],
  );
  if (rows.length === 0) throw new ApiError(404, 'Service not found');
  return rows[0];
}

/* ------------------------------------------------------------------ *
 * Reads are public — this is a status page. Writes require the admin. *
 * ------------------------------------------------------------------ */

// GET /api/services
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`${SERVICE_LIST_SQL} ORDER BY s.name ASC`);
    res.json({ services: rows.map(toServiceSummary) });
  }),
);

// GET /api/services/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await query(`${SERVICE_LIST_SQL} WHERE s.id = $1`, [id]);
    if (rows.length === 0) throw new ApiError(404, 'Service not found');
    res.json({ service: toServiceSummary(rows[0]) });
  }),
);

// GET /api/services/:id/stats — uptime windows + hourly 24h timeline
router.get(
  '/:id/stats',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const service = await findServiceOr404(id);

    const [uptime, timeline] = await Promise.all([getUptimeWindows(id), getTimeline24h(id)]);

    res.json({
      service,
      uptime,
      timeline_24h: timeline,
    });
  }),
);

// GET /api/services/:id/checks?limit=100 — raw history
router.get(
  '/:id/checks',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await findServiceOr404(id);

    const limit = Math.min(Math.max(parseId(req.query.limit ?? '100', 'limit'), 1), 1000);
    res.json({ checks: await getRecentChecks(id, limit) });
  }),
);

// GET /api/services/:id/incidents?days=30
router.get(
  '/:id/incidents',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await findServiceOr404(id);

    const days = Math.min(Math.max(parseId(req.query.days ?? '30', 'days'), 1), 90);
    res.json({ incidents: await getIncidents(id, { days }) });
  }),
);

// POST /api/services
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = validateServicePayload(req.body);

    const { rows } = await query(
      `INSERT INTO services (name, url, interval_seconds)
       VALUES ($1, $2, $3)
       RETURNING id, name, url, interval_seconds, created_at`,
      [payload.name, payload.url, payload.interval_seconds],
    );

    res.status(201).json({ service: rows[0] });
  }),
);

// PATCH /api/services/:id
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    await findServiceOr404(id);

    const payload = validateServicePayload(req.body, { partial: true });
    const fields = Object.keys(payload);
    const assignments = fields.map((field, index) => `${field} = $${index + 2}`);

    const { rows } = await query(
      `UPDATE services SET ${assignments.join(', ')}
       WHERE id = $1
       RETURNING id, name, url, interval_seconds, created_at`,
      [id, ...fields.map((field) => payload[field])],
    );

    res.json({ service: rows[0] });
  }),
);

// DELETE /api/services/:id — checks cascade
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { rowCount } = await query('DELETE FROM services WHERE id = $1', [id]);
    if (rowCount === 0) throw new ApiError(404, 'Service not found');
    res.status(204).end();
  }),
);

// POST /api/services/:id/check — probe now instead of waiting for the scheduler
router.post(
  '/:id/check',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const service = await findServiceOr404(id);
    res.json({ check: await runCheck(service) });
  }),
);

export default router;
