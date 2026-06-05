# GyanBrige — self-host on this PC, reachable from the internet (no port forwarding)

This deploys the **full monorepo** (Expo Web client + Fastify API + realtime +
transcription + worker + Docker infra) on this Windows machine and exposes it
through an **ngrok static domain** — so it works from anywhere without touching
your router. Live video uses **LiveKit Cloud** (WebRTC can't traverse an HTTP
tunnel, so the SFU lives in their cloud; everything else runs here).

## Architecture

```
Internet ──HTTPS/WSS──> ngrok static domain ──> Caddy :8080 (this PC)
                                                   ├─ /            -> Expo Web SPA (apps/app/dist)
                                                   ├─ /api/*        -> api          :4000
                                                   ├─ /socket.io/*  -> realtime      :4002
                                                   └─ /transcription/* -> transcription :4001
Live video:  browser <──WebRTC──> LiveKit Cloud (wss://<project>.livekit.cloud)
Docker infra (localhost): postgres 5432, mongo 27017, redis 6379, minio 9000, livekit 7880*
   * the local livekit container is unused once LiveKit Cloud is set.
```

Everything runs under **pm2** (auto-restart + survives reboot once `pm2 save` +
autostart are configured).

## One-time setup

### 1. Free accounts (the only things you must create yourself)
- **ngrok** — https://dashboard.ngrok.com → copy your **authtoken**, and under
  *Domains* claim your **free static domain** (e.g. `abcd-12-34.ngrok-free.app`).
- **LiveKit Cloud** — https://cloud.livekit.io → create a project → copy
  `wss://...livekit.cloud` URL, **API Key**, **API Secret**.

### 2. Fill `.env` (repo root)
```
PUBLIC_HOST=<your-static-domain>.ngrok-free.app
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...
```
(API_URL / REALTIME_URL / CORS_ORIGINS / EXPO_PUBLIC_* are derived from PUBLIC_HOST —
update them too, or re-run with the helper which reads PUBLIC_HOST.)

### 3. Register the ngrok authtoken (writes to ngrok's own config, not the repo)
```
ngrok config add-authtoken <token>
```

### 4. Build the web bundle (bakes the public URLs in)
```
powershell -ExecutionPolicy Bypass -File deploy\build-web.ps1
```

### 5. Start everything
```
powershell -ExecutionPolicy Bypass -File deploy\start-all.ps1
```
Visit `https://<your-static-domain>.ngrok-free.app`.
Default admin: `admin@gyanbrige.local` / `admin1234` — **change immediately**.

## Day-to-day

| Action            | Command |
|-------------------|---------|
| Status            | `pm2 status` |
| Logs              | `pm2 logs` (or `pm2 logs gb-api`) |
| Restart one       | `pm2 restart gb-api` |
| Stop app procs    | `deploy\stop-all.ps1` |
| Rebuild web       | `deploy\build-web.ps1` then `pm2 restart gb-caddy` |
| Stop infra too    | `pnpm infra:down` |

## Survive reboot (run once, after a successful `pm2 save`)
- Docker Desktop: Settings → "Start Docker Desktop when you log in".
- pm2: `pm2 save`, then register a logon Scheduled Task running `pm2 resurrect`
  (see deploy/install-autostart.ps1).
- Power: set the plan to never sleep (`powercfg /change standby-timeout-ac 0`).

## Known limitations
- **File uploads/downloads (MinIO):** served from localhost; remote users can't
  fetch them until MinIO is also exposed (add a `/storage` Caddy route + set
  MINIO_ENDPOINT to the public host). Deferred.
- **ngrok free tier:** one static domain, bandwidth cap, and an interstitial
  warning page on first visit. Upgrade or use a custom domain + Cloudflare Tunnel
  for production load.
- **LiveKit Cloud free tier:** monthly minutes/bandwidth limits.
- This machine must stay powered on, awake, and online to serve.
