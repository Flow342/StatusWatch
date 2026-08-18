-- StatusWatch schema.
-- Idempotent: safe to run repeatedly (`npm run migrate`).

CREATE TABLE IF NOT EXISTS services (
    id               SERIAL PRIMARY KEY,
    name             TEXT        NOT NULL,
    url              TEXT        NOT NULL,
    interval_seconds INTEGER     NOT NULL DEFAULT 300 CHECK (interval_seconds >= 30),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checks (
    id               SERIAL PRIMARY KEY,
    service_id       INTEGER     NOT NULL REFERENCES services (id) ON DELETE CASCADE,
    status           TEXT        NOT NULL CHECK (status IN ('up', 'down')),
    http_code        INTEGER,
    response_time_ms INTEGER,
    checked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Every read path filters by service and orders/filters by time.
CREATE INDEX IF NOT EXISTS checks_service_id_checked_at_idx
    ON checks (service_id, checked_at DESC);
