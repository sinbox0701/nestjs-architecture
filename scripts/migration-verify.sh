#!/usr/bin/env bash
#
# 로컬 마이그레이션 dry-run 검증.
# 임시 PostgreSQL 컨테이너를 띄워 pending 마이그레이션을 적용해 보고 정리한다.
# `_fix_`/`_repair_` 수정 마이그레이션이 양산되는 것을 방지한다.
# 참조: docs/convention/10-deployment.md, camp-backend docs/tech-debt/migration-management.md
#
# 사용: pnpm migration:verify
set -euo pipefail

CONTAINER="backend-template-migration-verify"
PORT="${MIGRATION_VERIFY_PORT:-55432}"
DB="backend_template_migration_verify"
USER="verify"
PASSWORD="verify"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[migration:verify] 임시 PostgreSQL 컨테이너 기동 (port ${PORT})..."
docker run -d --rm --name "$CONTAINER" \
  -e POSTGRES_DB="$DB" -e POSTGRES_USER="$USER" -e POSTGRES_PASSWORD="$PASSWORD" \
  -p "${PORT}:5432" postgres:17.6-alpine >/dev/null

echo "[migration:verify] DB ready 대기..."
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U "$USER" -d "$DB" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[migration:verify] 마이그레이션 적용..."
POSTGRES_HOST=localhost \
POSTGRES_PORT="$PORT" \
POSTGRES_DB="$DB" \
POSTGRES_USER="$USER" \
POSTGRES_PASSWORD="$PASSWORD" \
  pnpm mikro-orm migration:up

echo "[migration:verify] ✅ 통과 — pending 마이그레이션이 깨끗하게 적용됩니다."
