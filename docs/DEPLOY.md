# GyanBrige Deployment

Single-tenant self-hosted. One college = one docker-compose instance.

## Prerequisites

- Docker + docker-compose
- Node.js 20.10+
- pnpm 9+
- (optional) Rust toolchain for desktop builds
- (optional) Xcode + Android SDK for mobile builds

## First boot

```bash
bash infra/scripts/bootstrap-college.sh "Your College Name"
```

Generates `.env` with rotated secrets, brings up postgres + mongo + redis + minio + livekit, runs migrations, seeds an admin account.

Default admin: `admin@gyanbrige.local` / `admin1234` — change immediately.

## Per-service ports

| Service        | Port  | Purpose                                |
|----------------|-------|----------------------------------------|
| api            | 4000  | REST + tRPC                            |
| transcription  | 4001  | Whisper + notes generator              |
| realtime       | 4002  | Socket.IO (chat, presence, polls, wb)  |
| worker         | —     | BullMQ workers (no public port)        |
| postgres       | 5432  | Relational data                        |
| mongo          | 27017 | Chat/notifications/feed                |
| redis          | 6379  | BullMQ queues                          |
| minio          | 9000  | S3-compatible storage (uploads/recs)   |
| livekit        | 7880  | WebRTC SFU                             |
| app (dev)      | 8081  | Expo Web                               |
| desktop        | 1420  | Tauri dev shell                        |

## Running dev

```bash
pnpm install
pnpm dev                # api + realtime + transcription + worker + app
```

For desktop:

```bash
pnpm --filter @gyanbrige/app web        # in one terminal
pnpm --filter @gyanbrige/desktop dev    # in another (Tauri loads :8081)
```

## Production

1. Set strong secrets in `.env` (JWT_SECRET ≥ 48 chars, NFC_SIGNING_SECRET ≥ 32).
2. Set `NODE_ENV=production`.
3. Configure `CORS_ORIGINS` for your real domain.
4. Front everything behind nginx + TLS termination. See `infra/nginx/`.
5. Enable nightly backups: `0 2 * * * /path/to/infra/scripts/backup.sh`.
6. For local AI default: set `OLLAMA_URL` + admin flips backend to Ollama.

## Mobile builds

```bash
# iOS (requires Mac + Xcode)
pnpm --filter @gyanbrige/app run ios

# Android
pnpm --filter @gyanbrige/app run android

# Production via EAS
cd apps/app && eas build --platform all
```

## Desktop builds

```bash
pnpm --filter @gyanbrige/desktop build   # Windows .msi + macOS .dmg + Linux AppImage
```

Auto-update via Tauri updater — point `tauri.conf.json > plugins.updater.endpoints` at your release feed.

## Load testing

```bash
k6 run --vus 500 --duration 5m infra/loadtest/k6-live.js
k6 run infra/loadtest/k6-chat.js
```

## Backup + restore drill

```bash
infra/scripts/backup.sh                                 # backup
# To restore:
tar -xzf backups/gyanbrige-YYYYMMDD-HHMMSS.tar.gz
docker exec -i gyanbrige-postgres psql -U gyanbrige gyanbrige < postgres.sql
docker cp mongo gyanbrige-mongo:/tmp/restore
docker exec gyanbrige-mongo mongorestore --drop /tmp/restore
```

## Security checklist before launching

- [ ] Default admin password rotated
- [ ] `.env` permissions = 600
- [ ] TLS terminating at nginx / load balancer
- [ ] Rate limits in `services/api/src/index.ts` tuned for class size
- [ ] AI backend defaulted to local (Ollama) for data sovereignty
- [ ] Backup cron tested with a restore drill
- [ ] Webhook origin check enabled on `/api/livestreams/egress-webhook`
- [ ] Audit log retention policy set (90d default)
