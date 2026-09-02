#!/usr/bin/env bash
#
# Applies the schema and loads the deterministic test dataset into a stand that
# is already running (see scripts/test-env-up.sh, which calls this for you).
#
# Migrations go through the application's own mechanism — `npm run migrate` inside
# the backend image, which applies src/db/schema.sql — so the stand can never drift
# from what the app expects.
#
# The data itself is NOT the app's `npm run seed`: that generates 30 days of
# randomised history, which tests cannot assert on. scripts/test-seed.sql is loaded
# through psql instead, giving fixed ids, counts and uptime percentages.
#
# Usage:  scripts/seed-test-data.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/docker-compose.test.yml}"
SEED_SQL="${SEED_SQL:-${SCRIPT_DIR}/test-seed.sql}"

DB_SERVICE="${DB_SERVICE:-status-db}"
BACKEND_SERVICE="${BACKEND_SERVICE:-status-backend}"
DB_NAME="${DB_NAME:-statuswatch_test}"
DB_USER="${DB_USER:-statuswatch}"
DB_PASSWORD="${DB_PASSWORD:-statuswatch}"

compose() { docker compose -f "${COMPOSE_FILE}" "$@"; }

echo "==> Applying migrations (npm run migrate in ${BACKEND_SERVICE})"
compose exec -T "${BACKEND_SERVICE}" npm run migrate

echo "==> Loading test data from $(basename "${SEED_SQL}")"
compose exec -T -e PGPASSWORD="${DB_PASSWORD}" "${DB_SERVICE}" \
  psql -v ON_ERROR_STOP=1 -U "${DB_USER}" -d "${DB_NAME}" -q -f - < "${SEED_SQL}"

echo "==> Seed complete"
