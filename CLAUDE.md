# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

GyanBrige is an AI-powered education platform for Indian colleges, supporting English, Hindi, and Marathi. It has two runnable apps:

- **`frontend/`** — Next.js 16 web app (the active, working product). Runs standalone with a local JSON file database.
- **`apps/app/`** — Expo React Native mobile app (separate codebase, separate dev server).

The `services/` directories (`api/`, `realtime/`, `transcription/`, `worker/`) are an archived Fastify/Socket.IO/BullMQ backend from a prior monorepo phase. Their `src/` has been removed; only `node_modules` remain. Do not try to run them.

## Commands

### Frontend (Next.js web app)
```bash
cd frontend
npm install          # first time only
npm run dev          # dev server at http://localhost:3333 (configured in .claude/launch.json)
npm run build        # production build
npm run lint         # ESLint
```

### Expo mobile app
```bash
cd apps/app
npx expo start       # opens Expo Go / simulator picker
npx expo start --ios
npx expo start --android
```

No test suite exists in either app.

## Frontend architecture

### Database
`frontend/data/*.json` — flat JSON files (`users.json`, `courses.json`, `lectures.json`, `enrollments.json`, `attendance.json`, `invites.json`). All DB access goes through `src/lib/db.ts`, which reads/writes these files synchronously. No migrations needed; the DB is seeded automatically on first run via `initializeDB()` in `db.ts`.

### Auth
**Client-side only.** On login, the user object is stored in `localStorage` under the key `'user'`. Every API call attaches `x-user-id` and `x-user-role` headers via the `authFetch` wrapper (`src/lib/api.ts`). Server-side routes read these headers using `requireAuth` / `requireAdmin` from `src/lib/server-auth.ts`.

**Always use `authFetch` from `@/lib/api` for API calls in components — never raw `fetch`.** The only exception is `/api/auth/signup` and `/api/auth/login`, which are public.

### API routes (`src/app/api/`)
Next.js Route Handlers. Guarded routes import `requireAuth` or `requireAdmin` from `@/lib/server-auth`. The pattern:
```ts
import { requireAdmin } from '@/lib/server-auth';
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // ...
}
```

### AI notes generation (`src/app/api/generate-notes/route.ts`)
Two paths controlled by the `x-use-local-ai` header:
- **OpenAI path**: Whisper transcribes the audio (25 MB hard limit enforced server-side), then GPT generates notes.
- **Ollama path**: Caller must pre-transcribe and pass the transcript; Ollama generates notes locally on port 11434.

AI settings (model names, OpenAI key, local/cloud toggle) are stored in `localStorage` under `'aiSettings'` and passed as request headers (`x-openai-key`, `x-openai-model`, `x-ollama-model`). Admin configures them at `/dashboard/admin/ai`.

### Network attendance (`src/app/api/attendance/network-scan/route.ts`)
Runs `arp -a` on the server to detect devices on the local network. Matches MAC addresses against `users.json` (field `macAddress`). Admin assigns MACs to students at `/dashboard/admin/mac-assign`. The OUI vendor lookup is a static in-memory map in `src/lib/oui.ts`.

### Styling
Tailwind CSS v4 + custom CSS classes in `globals.css`. Key reusable classes: `glass` (frosted glass card), `glass-hover`, `btn-primary`, `input-glass`, `gradient-text`. Dark theme with emerald/teal accent, defined as CSS variables in `:root`.

### Role system
Three roles: `student`, `teacher`, `admin`. Dashboard routing: `/dashboard/student`, `/dashboard/teacher`, `/dashboard/admin`. Each page checks `localStorage.getItem('user')` and redirects to `/login` if the role doesn't match. All role checks are client-side only — the server validates via `x-user-role` header.

## Demo credentials (seeded on first run)
| Role    | Email                  | Password     |
|---------|------------------------|--------------|
| student | student@gyan.com       | student123   |
| teacher | teacher@gyan.com       | teacher123   |
| admin   | admin@gyan.com         | admin123     |

## Key decisions / gotchas

- **`authFetch` vs `fetch`**: Raw `fetch` in dashboard components will hit 401 on guarded routes. Always import `authFetch` from `@/lib/api`.
- **Whisper 25 MB limit**: The `/api/generate-notes` route rejects audio files over 25 MB with a clear error. Don't silently swallow Whisper errors — surface them to the UI.
- **Blob URLs**: When using `URL.createObjectURL`, create it in a `useEffect` and revoke it in the cleanup function. Don't call it in JSX (memory leak on every render).
- **Attendance useEffects**: When loading attendance for a course+date, include both `selectedCourse` and `selectedDate` in the deps array to avoid stale closures.
- **`editedRecordingUrl` vs `recordingUrl`**: The `Lecture` model (in the archived Fastify services/api schema) has both fields. Auto-edit results go to `editedRecordingUrl`; the original is preserved in `recordingUrl`.
