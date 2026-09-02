-- ---------------------------------------------------------------------------
-- Deterministic dataset for the automated test stand.
--
-- Loaded by scripts/seed-test-data.sh AFTER the application's own migrations
-- (npm run migrate) have created the schema.
--
-- Everything is expressed relative to NOW() and sits inside the last two hours,
-- so it falls into the 24h, 7d and 30d windows alike — all three report the same
-- uptime, which keeps assertions simple.
--
-- Re-running this file resets the data completely: ids are stable across runs.
-- ---------------------------------------------------------------------------

BEGIN;

TRUNCATE checks, services RESTART IDENTITY CASCADE;

INSERT INTO services (name, url, interval_seconds) VALUES
  ('Always Up',     'https://example.test/up',    300),  -- id 1
  ('Always Down',   'https://example.test/down',  300),  -- id 2
  ('Flaky',         'https://example.test/flaky', 300),  -- id 3
  ('No Checks Yet', 'https://example.test/fresh', 300);  -- id 4

-- id 1 — Always Up: 10 successes, every response exactly 100ms.
--   current_status = up, uptime = 100.00%, avg response = 100ms, 0 incidents.
INSERT INTO checks (service_id, status, http_code, response_time_ms, checked_at)
SELECT 1, 'up', 200, 100, NOW() - make_interval(mins => m)
FROM generate_series(5, 95, 10) AS m;

-- id 2 — Always Down: 5 consecutive failures, never recovered.
--   current_status = down, uptime = 0.00%, avg response = NULL,
--   1 ongoing incident: 5 failed checks, started 45m ago.
INSERT INTO checks (service_id, status, http_code, response_time_ms, checked_at)
SELECT 2, 'down', 500, NULL, NOW() - make_interval(mins => m)
FROM generate_series(5, 45, 10) AS m;

-- id 3 — Flaky: 8 successes and 2 failures, each failure closed by the next check.
--   current_status = up, uptime = 80.00%, avg response = 200ms,
--   exactly 2 resolved incidents, each lasting 10 minutes (600s).
INSERT INTO checks (service_id, status, http_code, response_time_ms, checked_at) VALUES
  (3, 'up',   200,  200, NOW() - INTERVAL '95 minutes'),
  (3, 'down', 503, NULL, NOW() - INTERVAL '85 minutes'),  -- incident 1 starts
  (3, 'up',   200,  200, NOW() - INTERVAL '75 minutes'),  -- incident 1 resolved
  (3, 'up',   200,  200, NOW() - INTERVAL '65 minutes'),
  (3, 'down', 503, NULL, NOW() - INTERVAL '55 minutes'),  -- incident 2 starts
  (3, 'up',   200,  200, NOW() - INTERVAL '45 minutes'),  -- incident 2 resolved
  (3, 'up',   200,  200, NOW() - INTERVAL '35 minutes'),
  (3, 'up',   200,  200, NOW() - INTERVAL '25 minutes'),
  (3, 'up',   200,  200, NOW() - INTERVAL '15 minutes'),
  (3, 'up',   200,  200, NOW() - INTERVAL '5 minutes');

-- id 4 — No Checks Yet: deliberately no rows, so the API reports
--   current_status = "unknown" and uptime = null rather than 0%.

COMMIT;

\echo 'seed: services and checks loaded'
SELECT s.id, s.name, COUNT(c.id) AS checks
FROM services s LEFT JOIN checks c ON c.service_id = s.id
GROUP BY s.id, s.name ORDER BY s.id;
