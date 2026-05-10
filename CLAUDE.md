# GyanBrige — Claude Code Instructions

GyanBrige is a live-class edtech platform. Students attend real-time lectures (LiveKit), lectures are transcribed (OpenAI Whisper), and AI generates structured notes from transcripts.

## Stack

| Layer | Tech |
|-------|------|
| Web | Next.js 16, TypeScript, Tailwind v4 |
| Mobile | React Native (GyanBrige/) |
| Backend | Node.js, Express, OpenAI SDK v4 |
| Streaming | LiveKit (livekit-client + livekit-server-sdk) |
| Transcription | OpenAI Whisper via transcriptionServer.js |

## Project Layout

```
web/src/app/          Next.js App Router pages and API routes
  api/                Server-side endpoints (auth, courses, lectures,
                      transcribe, generate-notes, livekit, livestreams,
                      attendance, progress, enrollments, upload, users)
  (pages)/            Client pages: login, signup, dashboard, courses

backend/              Standalone transcription microservice
  transcriptionServer.js
  services/noteGenerator.js

GyanBrige/            React Native mobile app
  src/screens/
  src/navigation/
  src/services/
```

## Code Style

- TypeScript strict mode in web/
- No comments unless the WHY is non-obvious
- Tailwind for all styling — no CSS-in-JS
- API routes live in web/src/app/api/[route]/route.ts

---

## Wiki Knowledge Base

**Vault path:** `d:/projects/GyanBrige/wiki-vault/`

The hot cache (wiki/hot.md) is automatically loaded at session start via hooks. It holds recent context in ~500 words. Read it before anything else.

### When to use the wiki

Use the wiki for: project decisions, architecture choices, past debugging sessions, feature designs, API contracts, third-party integrations, and domain knowledge specific to GyanBrige.

Do NOT use the wiki for: general React/Next.js/Node.js questions, TypeScript syntax, Tailwind usage, or anything answerable from the code itself.

### Tiered Query — read the minimum needed

| Tier | When | Files read | ~Tokens |
|------|------|------------|---------|
| **Hot** | Simple factual question | hot.md only | 500 |
| **Standard** | Most questions | hot.md + index.md + 3-5 pages | 3,000 |
| **Deep** | Full synthesis needed | hot.md + index.md + all relevant pages | 8,000+ |

**Rules:**
1. Check hot.md first. If it answers the question, stop.
2. Check index.md next. If the answer is in a summary line, stop. Do not open pages.
3. Only open individual pages when the index confirms they contain the answer.
4. Never read more than 5 pages for a standard question.
5. Deep mode only for synthesis queries ("compare everything about X").

### Wiki file paths

```
wiki/hot.md          rolling hot cache — read this first, always
wiki/index.md        master index of all pages
wiki/overview.md     project summary and decisions
wiki/concepts/       architecture and technical concepts
wiki/entities/       people, services, and systems
wiki/sources/        ingested research and documents
wiki/questions/      filed Q&A for reuse
wiki/log.md          chronological change log
```

### Writing back to the wiki

When you learn something worth keeping (a bug root cause, a design decision, an API quirk), offer to file it:
- Decisions → `wiki/concepts/`
- External APIs / services → `wiki/entities/`
- Research → `wiki/sources/`
- Q&A → `wiki/questions/`

After every write, update `wiki/index.md` (add the entry) and `wiki/log.md` (append one line).

At session end, update `wiki/hot.md` with a summary under 500 words. Format:
```
## Last Updated
[date + what changed]

## Key Recent Facts
[bullet list of most important current facts]

## Recent Changes
[what was modified this session]

## Active Threads
[ongoing work, open decisions, next steps]
```

### Ingesting sources

Drop any file into `d:/projects/GyanBrige/wiki-vault/.raw/` then say "ingest [filename]".

### Skills available (run in the wiki-vault directory)

| Command | What it does |
|---------|-------------|
| `/wiki` | Setup and vault status |
| `ingest [file]` | Add a source to the knowledge base |
| `lint the wiki` | Find orphans, dead links, gaps |
| `/save` | File current conversation as a wiki note |
| `/autoresearch [topic]` | Autonomous research loop |

---

## Credit Discipline

These rules apply to every response:

- Never read wiki files speculatively. Only read when a question requires wiki context.
- Never read the full wiki index to answer a yes/no question.
- Prefer editing existing wiki pages (surgical PATCH) over rewriting them entirely.
- Use parallel tool calls when reads are independent.
- Ingest sources with delta tracking — never re-process a file that hasn't changed.
- Hot cache is the first and often last read needed. Trust it.
