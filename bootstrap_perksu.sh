#!/usr/bin/env bash
set -euo pipefail

# bootstrap_perksu.sh — bring up the Perksu development stack, run migrations and seeds
# Usage: ./bootstrap_perksu.sh [--no-build] [--no-migrate] [--no-seed]

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

COMPOSE=${COMPOSE:-docker-compose}
POSTGRES_SERVICE=${POSTGRES_SERVICE:-postgres}
BACKEND_SERVICE=${BACKEND_SERVICE:-backend}
POSTGRES_USER=${POSTGRES_USER:-perksu}
POSTGRES_DB=${POSTGRES_DB:-perksu}
WAIT_TIMEOUT=${WAIT_TIMEOUT:-180}

NO_BUILD=false
NO_MIGRATE=false
NO_SEED=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build) NO_BUILD=true; shift ;;
    --no-migrate) NO_MIGRATE=true; shift ;;
    --no-seed) NO_SEED=true; shift ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--no-build] [--no-migrate] [--no-seed]

Options:
  --no-build     Skip rebuilding images (useful for faster restarts)
  --no-migrate   Skip running alembic migrations
  --no-seed      Skip running backend seed scripts
EOF
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

echo "==> Starting Perksu bootstrap"

if [ "$NO_BUILD" = false ]; then
  echo "==> Building and starting containers (detached)..."
  $COMPOSE up -d --build
else
  echo "==> Starting containers without build..."
  $COMPOSE up -d
fi

wait_for_health() {
  svc="$1"
  timeout=${2:-$WAIT_TIMEOUT}
  echo "==> Waiting for service '$svc' to be healthy (timeout ${timeout}s)"
  start=$(date +%s)
  while true; do
    cid=$($COMPOSE ps -q "$svc" 2>/dev/null || true)
    if [ -n "$cid" ]; then
      # if container has a Health check, prefer it; otherwise consider running
      health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)
      if [ "$health" = "healthy" ] || [ "$health" = "running" ]; then
        echo "    -> $svc is $health"
        return 0
      fi
    fi

    now=$(date +%s)
    if (( now - start > timeout )); then
      echo "    -> timed out waiting for $svc (continuing for now)"
      return 1
    fi
    sleep 2
  done
}

# Wait for Postgres first
wait_for_health "$POSTGRES_SERVICE" 180 || true

if [ "$NO_MIGRATE" = false ]; then
  echo "==> Preparing DB for Alembic migrations"

  # Ensure alembic_version.version_num column can store long revision ids (idempotent)
  echo "Checking alembic_version.version_num column size..."
  # Query column length (empty if not present)
  len=$(docker-compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT character_maximum_length FROM information_schema.columns WHERE table_name='alembic_version' AND column_name='version_num';" | tr -d '[:space:]' || true)
  if [ -n "$len" ] && [ "$len" != "NULL" ]; then
    if [ "$len" -lt 100 ]; then
      echo "    -> increasing alembic_version.version_num to varchar(255)"
      docker-compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER TABLE alembic_version ALTER COLUMN version_num TYPE varchar(255);" || true
    else
      echo "    -> alembic_version.version_num length is $len, OK"
    fi
  else
    echo "    -> alembic_version.version_num not present yet, skipping alter"
  fi

  echo "==> Alembic heads (for debugging)"
  docker-compose exec -T "$BACKEND_SERVICE" alembic heads --verbose || true

  echo "==> Applying Alembic migrations (upgrade heads)"
  docker-compose exec -T "$BACKEND_SERVICE" alembic upgrade heads

  echo "==> Alembic current version"
  docker-compose exec -T "$BACKEND_SERVICE" alembic current || true
else
  echo "==> Skipping migrations (--no-migrate)"
fi

# Restart backend so it picks up schema changes
echo "==> Restarting backend service: $BACKEND_SERVICE"
docker-compose restart "$BACKEND_SERVICE" || true
wait_for_health "$BACKEND_SERVICE" 120 || true

if [ "$NO_SEED" = false ]; then
  echo "==> Running known backend seed/repair scripts if present"
  # Some optional seeds/repairs that exist in repo; run them if they are present in container
  for s in seed_repair.py seed.py setup_platform_admin.py; do
    if docker-compose exec -T "$BACKEND_SERVICE" test -f /app/$s >/dev/null 2>&1; then
      echo "    -> running /app/$s"
      docker-compose exec -T "$BACKEND_SERVICE" python /app/$s || true
    fi
  done
else
  echo "==> Skipping seeds (--no-seed)"
fi

echo "==> Final container status"
docker-compose ps

echo "==> Tail backend logs (last 200 lines)"
docker-compose logs --tail=200 "$BACKEND_SERVICE"

echo "Bootstrap complete."

exit 0
