#!/usr/bin/env bash
#
# Brings up the ephemeral test stand, waits until every service reports healthy,
# loads the deterministic fixture, and prints the base URLs the tests should use.
#
# Usage:
#   scripts/test-env-up.sh
#   BACKEND_TAG=sha-abc123 FRONTEND_TAG=sha-abc123 scripts/test-env-up.sh
#   BACKEND_PORT=24000 FRONTEND_PORT=28080 scripts/test-env-up.sh
#   SKIP_SEED=1 scripts/test-env-up.sh      # schema only, no fixture
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/docker-compose.test.yml}"
BACKEND_PORT="${BACKEND_PORT:-14000}"
FRONTEND_PORT="${FRONTEND_PORT:-18080}"
# Total time to wait for the stack to become healthy.
WAIT_TIMEOUT="${WAIT_TIMEOUT:-180}"

export BACKEND_TAG="${BACKEND_TAG:-latest}"
export FRONTEND_TAG="${FRONTEND_TAG:-latest}"
export BACKEND_PORT FRONTEND_PORT

SERVICES=(status-db status-backend status-frontend)

compose() { docker compose -f "${COMPOSE_FILE}" "$@"; }

# Prints the health state of one service: healthy | unhealthy | starting | none | missing
service_health() {
  local container
  container="$(compose ps -q "$1" 2>/dev/null || true)"
  if [[ -z "${container}" ]]; then
    echo "missing"
    return
  fi
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
    "${container}" 2>/dev/null || echo "missing"
}

dump_diagnostics() {
  echo
  echo "--- docker compose ps ---"
  compose ps || true
  for service in "${SERVICES[@]}"; do
    echo
    echo "--- last 40 log lines: ${service} ---"
    compose logs --tail=40 "${service}" 2>&1 || true
  done
}

echo "==> Starting stand (backend:${BACKEND_TAG}, frontend:${FRONTEND_TAG})"
compose up -d --remove-orphans

echo "==> Waiting for services to become healthy (timeout ${WAIT_TIMEOUT}s)"
deadline=$(( SECONDS + WAIT_TIMEOUT ))
while :; do
  all_healthy=true
  states=""

  for service in "${SERVICES[@]}"; do
    state="$(service_health "${service}")"
    states+=" ${service}=${state}"

    case "${state}" in
      healthy) ;;
      # A container that died or failed its healthcheck will not recover on its
      # own — fail immediately rather than burning the whole timeout.
      unhealthy|missing)
        echo "!! ${service} is ${state}"
        dump_diagnostics
        exit 1
        ;;
      *) all_healthy=false ;;
    esac
  done

  if [[ "${all_healthy}" == true ]]; then
    echo "==> All services healthy:${states}"
    break
  fi

  if (( SECONDS >= deadline )); then
    echo "!! Timed out after ${WAIT_TIMEOUT}s waiting for:${states}"
    dump_diagnostics
    exit 1
  fi

  sleep 2
done

if [[ "${SKIP_SEED:-0}" == "1" ]]; then
  echo "==> SKIP_SEED=1, not seeding"
else
  COMPOSE_FILE="${COMPOSE_FILE}" "${SCRIPT_DIR}/seed-test-data.sh"
fi

cat <<SUMMARY

==> Test stand is ready

  Backend  http://localhost:${BACKEND_PORT}
  API      http://localhost:${BACKEND_PORT}/api
  Frontend http://localhost:${FRONTEND_PORT}

  Admin login: admin / test-password

  Stop with: scripts/test-env-down.sh
SUMMARY
