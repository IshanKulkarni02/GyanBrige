# GyanBrige Feature Catalog

36 features shipped across Phases 0–9.

## Originals (1–8)

| # | Feature | Surface |
|---|---------|---------|
| 1 | Live lecture streaming | LiveKit room + token + teacher/student stage |
| 2 | Recording of lectures | Egress → existing lectureProcessor pipeline |
| 3 | Multi-language AI notes | `outputLanguage` end-to-end; NotesTranslation cache |
| 4 | Local LLM toggle | Admin AI settings screen, /api/admin/ai-settings |
| 5 | Network attendance | CIDR + BSSID validation, /api/attendance/network |
| 6 | Online-attendance cap | cap-enforcer at LiveKit token mint |
| 7 | Admin cap config | /admin/caps screen + /api/admin/caps |
| 8 | NFC start + QR + USB-NFC | HMAC-signed payload, rotating QR, Tauri pcsc-lite |

## User's must-haves (9–16)

| # | Feature | Surface |
|---|---------|---------|
| 9 | Online tests + opt-in proctoring | /api/tests, /tests/[id]/attempt screen with tab/copy proctoring |
| 10 | Messaging (1:1 + group + class + club) | /api/chat + Socket.IO chat gateway |
| 11 | Notice board with acks | /api/notices, /notices screen |
| 12 | Feedback forms (anon/named) | /api/feedback, /feedback screen |
| 13 | Results + GPA + grade audit | /api/results, /results screen, GradeAudit table |
| 14 | Assignments + plagiarism | files + text + git URL; MinHash + winnowing |
| 15 | Clubs + events + RSVP/check-in | /api/clubs, /clubs screen, NFC/QR check-in |
| 16 | Application forms + approval workflow | /api/applications, state-machine workflow JSON |

## Cutting-edge (17–36)

| # | Feature | Surface |
|---|---------|---------|
| 17 | AI tutor (RAG) | /api/ai-tutor/ask + /tutor screen; citations link to timestamps |
| 18 | Personalized study plan | generate-study-plan worker + /api/study-plan |
| 19 | Adaptive flashcards (SM-2) | flashcard-gen worker + /api/flashcards + /flashcards screen |
| 20 | AI auto-grade essays | autograde-essay worker (teacher-in-loop) |
| 21 | AI doubt board | /api/doubts + /doubts screen, AI draft with citations |
| 22 | Dropout-risk dashboard | dropout-risk worker (GBM-style local model) + /admin/dropout-risk |
| 23 | Engagement heatmap | /api/analytics/lecture/:id/engagement-heatmap |
| 24 | Outcome/accreditation export | /api/accreditation/course/:id/outcomes (JSON + CSV) |
| 25 | Live class telemetry | live-telemetry gateway in services/realtime |
| 26 | Collaborative whiteboard (Y.js) | whiteboard gateway in services/realtime |
| 27 | Peer review for assignments | double-blind allocator at /api/assignments/:id/peer-allocate |
| 28 | Study group voice rooms | (LiveKit voice-only — reuses Phase 2 infra) |
| 29 | Mentor matching | /api/mentors/suggestions + request workflow |
| 30 | Google Calendar/Drive sync | /api/integrations/google/sync-calendar |
| 31 | Live captions + translation | captions-translate queue (whisper.cpp stream) |
| 32 | Offline-first | apps/app/lib/offline.ts cache + mutation queue |
| 33 | Accessibility pack | apps/app/lib/a11y.ts (font scale, dyslexia, contrast) |
| 34 | Live polls + "I'm lost" | poll gateway in services/realtime |
| 35 | Smart search (hybrid) | /api/search across transcripts + notes + chat + assignments |
| 36 | Gamification | /api/gamification/{me,leaderboard,login-event} + /gamification screen |

## API surface summary

| Module                          | Routes |
|---------------------------------|--------|
| auth, users, departments, subjects, courses, classrooms, timetable | Domain CRUD |
| lectures, livestreams, notes    | Live + recording + notes |
| attendance, nfc                 | Mark-in flows + tag management |
| tests, assignments, results, feedback, notices | Graded work + community |
| chat, clubs, applications        | Realtime + community + workflow |
| ai-tutor, doubts, flashcards, search, study-plan | AI personalization |
| analytics, accreditation, gamification, mentors | Phase 8 |
| admin/{caps, campus-networks, ai-settings, sis-import} | Admin tools |
| integrations/google             | External sync |

## Worker queues

bulk-import · plagiarism-text · plagiarism-code · embed-transcript · flashcard-gen · generate-study-plan · autograde-essay · dropout-risk · chapter-detect · captions-translate
