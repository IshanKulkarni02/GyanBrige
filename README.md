# GyanBrige

Self-hosted college LMS. Live classes, AI notes, attendance, tests, assignments, community. Runs on web, Windows, macOS, Android, iOS from one codebase.

## Repo Layout

```
apps/
  app/          Expo (iOS + Android + Web) — single client
  desktop/      Tauri shell wrapping the Expo Web build (Windows + macOS)
services/
  api/          Main HTTP API (Fastify + tRPC + Prisma + BullMQ)
  realtime/     Socket.IO server (chat, presence, polls, whiteboard ops)
  transcription/ Existing Whisper + notes microservice (untouched)
  worker/       BullMQ workers (embeddings, plagiarism, study plans, ...)
  nfc-bridge/   Tiny helper for classroom workstations without WebHID
packages/
  db/           Prisma client + Mongo client + shared schemas
  ui/           Cross-platform components
  auth/         JWT verify, role guards
  config/       Shared eslint/tsconfig, env validation
  types/        Shared TS types
  rag/          Embeddings + retrieval helpers
  events/       Typed Socket.IO event contracts
  accessibility/ A11y primitives (font scaling, dyslexia mode, contrast)
  icons/
infra/
  docker-compose.yml   postgres, mongo, redis, minio, livekit, services
  livekit/, nginx/, postgres/, mongo/, redis/, minio/
  scripts/bootstrap-college.sh
docs/
  ARCHITECTURE.md, SECURITY.md, DEPLOY.md, FEATURES.md
```

## Quick Start (dev)

```
cp .env.example .env
pnpm install
pnpm infra:up                 # postgres, mongo, redis, minio, livekit
pnpm db:migrate
pnpm db:seed
pnpm dev                      # api + realtime + transcription + worker + app
```

Open http://localhost:8081 for the Expo Web build.

## Feature Plan

See [docs/FEATURES.md](docs/FEATURES.md) for the full catalog (36 features across 9 phases) and `C:\Users\Ishan\.claude\plans\breezy-jumping-cat.md` for the build plan.
