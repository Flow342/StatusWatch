#!/usr/bin/env bash
#
# Tears the test stand down, removing volumes and the network so the next run
# starts from nothing.
#
# Usage:  scripts/test-env-down.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${COMPOSE_FILE:-${REPO_ROOT}/docker-compose.test.yml}"

# Only needed so compose can interpolate the file; the values do not matter here.
export BACKEND_TAG="${BACKEND_TAG:-latest}"
export FRONTEND_TAG="${FRONTEND_TAG:-latest}"

echo "==> Stopping stand and removing volumes and network"
docker compose -f "${COMPOSE_FILE}" down --volumes --remove-orphans

echo "==> Done"
