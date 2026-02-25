#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./apps/api/scripts/reset-db.sh
#   ./apps/api/scripts/reset-db.sh --with-seed
#
# This script resets the DB schema using Prisma.
# It removes ALL data and recreates schema from migrations.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WITH_SEED="false"

if [[ "${1:-}" == "--with-seed" ]]; then
  WITH_SEED="true"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm no está disponible. Instálalo o usa corepack."
  exit 1
fi

cd "$ROOT_DIR"

echo ">> Reset completo de base de datos (destructivo)..."
pnpm --filter api exec prisma migrate reset --force --skip-seed

echo ">> Prisma generate..."
pnpm --filter api exec prisma generate

if [[ "$WITH_SEED" == "true" ]]; then
  echo ">> Ejecutando seed..."
  pnpm --filter api prisma:seed
fi

echo ">> OK. Base reiniciada."
echo "Siguiente paso recomendado: importar datos manuales desde Admin > Importar."
