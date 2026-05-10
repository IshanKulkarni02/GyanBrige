---
type: overview
title: "GyanBrige Wiki Overview"
created: 2026-04-26
updated: 2026-04-26
tags:
  - meta
  - overview
status: developing
related:
  - "[[index]]"
  - "[[hot]]"
  - "[[log]]"
---

# GyanBrige Wiki Overview

Navigation: [[index]] | [[hot]] | [[log]]

---

## What GyanBrige Is

GyanBrige is a live-class edtech platform for Indian students. The core loop:

1. Teacher starts a live class (LiveKit WebRTC session)
2. Audio is recorded and uploaded
3. OpenAI Whisper transcribes the lecture
4. Claude generates structured study notes from the transcript
5. Students receive notes and can review the lecture

---

## Stack

| Layer | Tech | Location |
|-------|------|----------|
| Web frontend | Next.js 16, TypeScript, Tailwind v4 | `web/` |
| Web API | Next.js App Router API routes | `web/src/app/api/` |
| Mobile | React Native | `GyanBrige/` |
| Transcription service | Node.js, Express, multer, Whisper | `backend/` |
| Streaming | LiveKit | `web/src/app/api/livekit/` |
| AI notes | OpenAI SDK v4 | `backend/services/noteGenerator.js` |

---

## Key API Routes

- `POST /api/auth/*` — registration, login, session
- `GET/POST /api/courses` — course CRUD
- `GET/POST /api/lectures` — lecture management
- `POST /api/transcribe` — send audio to Whisper
- `POST /api/generate-notes` — generate notes from transcript
- `GET /api/livekit` — get LiveKit access token
- `POST /api/livestreams` — start/stop live session
- `GET /api/attendance` / `progress` / `enrollments` — student tracking
- `POST /api/upload` — file uploads
- `GET/POST /api/users` — user management

---

## Current State

- Sources ingested: 0
- Wiki pages: 3 (hot, index, overview)
- Last activity: 2026-04-26 (bootstrap)

---

## Wiki Purpose

This wiki accumulates:
- Architecture decisions and their rationale
- Bug root causes and fixes (so the same bug is never debugged twice)
- API quirks (LiveKit, Whisper, OpenAI)
- Feature design notes
- Third-party integration details
