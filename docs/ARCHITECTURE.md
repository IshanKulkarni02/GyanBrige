# GyanBrige Architecture

## Repo layout

```
apps/
  app/          Expo (iOS + Android + Web)  — the single client codebase
  desktop/      Tauri shell wrapping the Expo Web build (Windows + macOS)
services/
  api/          Fastify + Prisma + zod + BullMQ — main HTTP API (≈34 modules)
  realtime/     Socket.IO server — chat, presence, polls, whiteboard, telemetry
  transcription/ Whisper + notes generator (preserved verbatim; extended)
  worker/       BullMQ workers — embeddings, plagiarism, study plans, AI grading,
                dropout risk, chapter detection, flashcards, SIS import
infra/
  docker-compose.yml   postgres + mongo + redis + minio + livekit
  loadtest/            k6 scenarios
  scripts/             bootstrap-college.sh, backup.sh
docs/                  this folder
```

## Data flow: live lecture

1. Teacher hits "Start" on iOS / web / desktop → `POST /api/livestreams/rooms`
2. API creates LiveSession row + LiveKit room
3. Students join → `POST /api/livestreams/token` (cap-enforcer checks online cap)
4. LiveKit handles WebRTC SFU
5. Teacher hits "Record" → `startRoomCompositeEgress`
6. LiveKit writes MP4 → webhook fires to `services/transcription`
7. transcription downloads MP4 → existing `lectureProcessor` runs:
   - video: thumbnail + H.264 transcode
   - notes: audio extraction + Whisper + AI notes generation
8. transcription POSTs job result back to `/api/livestreams/egress-webhook`
9. API sets `Lecture.recordingUrl` + `transcriptionJobId`
10. Worker queue `embed-transcript` fires → pgvector indexed → AI tutor + search live

## Data flow: attendance

```
NFC tap / QR scan / Network self-report / Manual / Live join
                              ↓
                  /api/attendance  (one canonical write path)
                              ↓
              verify (signature / CIDR / enrollment)
                              ↓
                   cap-enforcer (online mode only)
                              ↓
                  upsert Attendance row + audit
```

## Data flow: graded work

- **Tests:** MCQ/MSQ/SHORT auto-graded server-side at every answer write; CODE
  runs in Docker sandbox (worker); LONG/CODE-essay routed to `autograde-essay`
  worker (always teacher-in-loop).
- **Assignments:** text submissions trigger `plagiarism-text` (MinHash);
  Git URLs trigger `plagiarism-code` (winnowing).
- **Peer review:** double-blind round-robin allocation; reviewer score never
  visible to author until teacher publishes.

## Data flow: AI personalization

- Worker `embed-transcript` runs after recording is processed → fills pgvector
- `/api/ai-tutor/ask` retrieves top-k chunks, sends to configured LLM (local
  Ollama or OpenAI) via `services/transcription`, returns answer + citations
- `/api/doubts` does the same but persists question + AI draft + community votes
- `generate-study-plan` runs weekly per student; pulls missed lectures,
  low-score quiz Qs, failed flashcards → outputs day-by-day checklist
- `flashcard-gen` extracts Q/A pairs from notes; SM-2 schedules reviews

## Cross-platform delivery

| Capability        | iOS               | Android          | Web              | Win/Mac (Tauri)        |
|-------------------|-------------------|------------------|------------------|------------------------|
| Live video        | RN SDK            | RN SDK           | livekit-client   | livekit-client         |
| NFC               | nfc-manager       | nfc-manager      | Web NFC (Android)| Tauri Rust + pcsc-lite |
| QR                | expo-camera       | expo-camera      | getUserMedia     | Tauri camera           |
| Wi-Fi BSSID       | expo-network      | NetInfo          | WebRTC IP enum   | OS query via Tauri     |
| Push              | expo-notifications| expo-notifications| web-push (VAPID)| tauri-notification     |
| Offline cache     | expo-sqlite       | expo-sqlite      | IndexedDB        | Tauri sqlite           |
| Webcam proctor    | expo-camera       | expo-camera      | getUserMedia     | Tauri camera           |

Each capability is exposed via a single TS module in `apps/app/lib/`; feature
code calls the module, not the platform.

## Why two databases

- Postgres: relational integrity for grades, attendance, audit, results, caps.
- Mongo: chat firehose + activity feed + notifications. Append-heavy unstructured
  data that should never block grade transactions.

## Background jobs (BullMQ)

| Queue                | Trigger                          | Owner                |
|----------------------|----------------------------------|----------------------|
| bulk-import          | Admin SIS CSV upload             | services/worker      |
| plagiarism-text      | Text submission ≥ 200 chars      | services/worker      |
| plagiarism-code      | Submission with Git URL          | services/worker      |
| embed-transcript     | Lecture finished processing      | services/worker      |
| flashcard-gen        | Notes generated                  | services/worker      |
| autograde-essay      | Teacher requests AI grade        | services/worker      |
| generate-study-plan  | Cron weekly + on-demand          | services/worker      |
| dropout-risk         | Cron nightly                     | services/worker      |
| chapter-detect       | After embed-transcript           | services/worker      |
| captions-translate   | Live caption stream              | services/transcription|

## Failure modes addressed

- Transcription service down → API queues notes-generation lazily
- Mongo down → chat returns 503, but grades/attendance unaffected
- Redis down → workers retry on reconnect; idempotent upserts everywhere
- LiveKit down → fallback flag in token endpoint returns 503 with explicit message
- Plagiarism worker crashes mid-job → BullMQ retry; submission status unchanged
