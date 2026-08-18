import config from '../config.js';
import { query } from '../db/pool.js';

/**
 * Probes a single URL. Never throws — a failed probe is a legitimate "down" result.
 * Returns the shape of a `checks` row (without id / service_id).
 */
export async function probe(url) {
  const startedAt = process.hrtime.bigint();

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': config.scheduler.userAgent, accept: '*/*' },
      signal: AbortSignal.timeout(config.scheduler.timeoutMs),
    });

    // Drain the body so the socket is released and the timing reflects a full response.
    await response.arrayBuffer().catch(() => undefined);

    const responseTimeMs = Number((process.hrtime.bigint() - startedAt) / 1000n) / 1000;

    return {
      status: response.ok ? 'up' : 'down',
      http_code: response.status,
      response_time_ms: Math.round(responseTimeMs),
    };
  } catch (err) {
    // DNS failure, connection refused, TLS error, or timeout: no HTTP code exists.
    const responseTimeMs = Number((process.hrtime.bigint() - startedAt) / 1000n) / 1000;
    return {
      status: 'down',
      http_code: null,
      response_time_ms: Math.round(responseTimeMs),
      reason: err.name === 'TimeoutError' ? 'timeout' : err.message,
    };
  }
}

/** Probes a service and persists the result. Returns the stored check row. */
export async function runCheck(service) {
  const result = await probe(service.url);

  const { rows } = await query(
    `INSERT INTO checks (service_id, status, http_code, response_time_ms)
     VALUES ($1, $2, $3, $4)
     RETURNING id, service_id, status, http_code, response_time_ms, checked_at`,
    [service.id, result.status, result.http_code, result.response_time_ms],
  );

  return rows[0];
}
