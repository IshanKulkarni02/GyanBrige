#!/usr/bin/env bash
# Bootstrap a fresh GyanBrige instance for one college.
# Usage: ./bootstrap-college.sh [college-name]

set -euo pipefail

COLLEGE_NAME="${1:-Demo College}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> Bootstrapping GyanBrige for: $COLLEGE_NAME"

if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
  JWT=$(openssl rand -base64 32 | tr -d '=+/' | head -c 48)
  NFC=$(openssl rand -base64 24 | tr -d '=+/' | head -c 36)
  INV=$(openssl rand -base64 24 | tr -d '=+/' | head -c 36)
  LK=$(openssl rand -base64 32 | tr -d '=+/' | head -c 48)
  sed -i.bak "s|change-me-please-this-is-a-secret-please-change-it|$JWT|" .env || true
  sed -i.bak "s|change-me-too-rotate-per-tag-batch|$NFC|" .env || true
  sed -i.bak "s|change-me-three|$INV|" .env || true
  sed -i.bak "s|devsecret-change-me-32-characters-min|$LK|" .env || true
  rm -f .env.bak
  echo "   secrets generated"
fi

echo "==> Bringing up infra (postgres, mongo, redis, minio, livekit)..."
docker compose -f infra/docker-compose.yml up -d
sleep 5

echo "==> Installing pnpm deps..."
pnpm install --frozen-lockfile

echo "==> Running Prisma migrations..."
pnpm --filter @gyanbrige/api db:generate
pnpm --filter @gyanbrige/api db:migrate:deploy

echo "==> Seeding initial data..."
pnpm --filter @gyanbrige/api db:seed

echo ""
echo "  GyanBrige is ready."
echo "  - API:    http://localhost:4000/api/health"
echo "  - App:    pnpm --filter @gyanbrige/app dev"
echo "  - Admin:  admin@gyanbrige.local / admin1234"
echo ""
echo "  Next: rotate JWT_SECRET in production, set OPENAI_API_KEY or OLLAMA_URL."
