# GyanBrige Security Model

## Identity

- Argon2id password hashing
- JWT in httpOnly cookie (web) + bearer header (mobile/desktop)
- Google OAuth optional, signature verified server-side
- Invite links signed HMAC-SHA256 with `INVITE_SIGNING_SECRET`, single-use counter enforced server-side

## Authorization

- Role-based (STUDENT, TEACHER, ADMIN, STAFF, CLUB_LEAD)
- Per-resource ownership checked in route handlers
- Audit log on every mutating route (`AuditLog` table)

## Online-cap enforcement

- Cap check at LiveKit token mint (`/api/livestreams/token`) — token never issued past cap
- Re-checked at every `POST /api/attendance` for online mode

## NFC + QR

- HMAC-SHA256 over `{tagId, classroomId, nonce, exp}` per tag
- Per-tag rotating secret (no global key) → physical tag revocation
- QR re-mints payload every 30s window → screenshot replay rejected
- Tag must be bound to the lecture's classroom (timetable cross-check)

## Proctoring data

- Webcam frames are sampled client-side, only face-presence boolean reported
- Full recording is stored only if test creator opted into `strictProctoring`
- All proctoring events logged immutably to `ProctoringEvent`
- Test attempt enters `DISQUALIFIED` only on teacher decision, never auto-flagged in v1

## Data sovereignty

- Local AI backend (Ollama) is the recommended default for new installs
- Admin can flip via `/api/admin/ai-settings`
- When local, no lecture content leaves the college network

## Webhooks

- LiveKit Egress webhook protected by URL secret + payload validation
- `services/transcription` → `services/api` egress callback uses `INTERNAL_API_TOKEN` header

## Audit + retention

- All mutating routes write `AuditLog` rows
- Default retention: 365 days for audit, 90 days for engagement events
- Grade changes always logged in `GradeAudit` (separate immutable table)
