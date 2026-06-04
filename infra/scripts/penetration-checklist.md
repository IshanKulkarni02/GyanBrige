# Pre-launch Penetration Checklist

Run through before exposing a college instance to students.

## Auth
- [ ] Argon2 work factor ≥ 2^16 RAM, 3 iterations
- [ ] JWT secret rotated from defaults; HS256 only
- [ ] Cookie has `Secure`, `HttpOnly`, `SameSite=Lax`
- [ ] Invite-link HMAC verified before any DB write
- [ ] Replayed invite token → 410 GONE (counter enforced server-side)
- [ ] Google OAuth idToken verified against `GOOGLE_CLIENT_ID`

## Authorization
- [ ] Every mutating route calls `requireAuth` or `requireRole`
- [ ] Cross-tenant access blocked: student A cannot read student B's submissions
- [ ] Teacher A cannot see roster of teacher B's course
- [ ] Admin caps cannot be downgraded mid-period to retroactively block students

## Attendance
- [ ] Replayed NFC payload (>30s old) → 401 EXPIRED
- [ ] Forged HMAC payload with random secret → 401 SIGNATURE
- [ ] NFC tag from classroom A used on lecture in classroom B → 409 WRONG_ROOM
- [ ] CIDR mismatch → 403 OFF_CAMPUS
- [ ] BSSID not in CampusNetwork table → 403 UNKNOWN_AP
- [ ] Online cap blocks token mint → 403 ONLINE_CAP_EXCEEDED

## Tests
- [ ] Already-submitted attempt can't be re-answered → 409 SUBMITTED
- [ ] Tab-blur during strict-mode test logs ProctoringEvent
- [ ] Copy/paste in strict mode blocked + logged
- [ ] Student cannot read other students' attempt answers

## Assignments
- [ ] Past-due submission with `allowsLate=false` → 409 PAST_DUE
- [ ] Git URL plagiarism: cloned-only into /tmp, no network access from sandbox
- [ ] Peer review: reviewer ≠ author (allocator enforces)
- [ ] Plagiarism report visible only to teacher + author (not other students)

## Webhooks
- [ ] LiveKit egress webhook requires `INTERNAL_API_TOKEN`
- [ ] Transcription → API callback also requires `INTERNAL_API_TOKEN`
- [ ] Egress URL not exposed publicly without auth

## File uploads
- [ ] MinIO bucket public read DISABLED for non-recording prefixes
- [ ] Uploaded assignment files virus-scanned (recommend ClamAV sidecar)
- [ ] Filename sanitized; no path traversal

## Rate limits
- [ ] Login endpoint: 5/min per IP
- [ ] Signup: 3/hour per IP
- [ ] Attendance mark: 30/min per user
- [ ] AI tutor ask: 20/min per user

## Backups
- [ ] Backup script tested end-to-end with restore drill
- [ ] Backups encrypted at rest
- [ ] Off-site copy (cold storage) configured

## Logging
- [ ] AuditLog populated for every mutating route
- [ ] Sensitive fields redacted (password, secret, token)
- [ ] Logs shipped off-host (no log loss on disk full)
