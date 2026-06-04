# Graph Report - .  (2026-05-11)

## Corpus Check
- Corpus is ~5,754 words - fits in a single context window. You may not need a graph.

## Summary
- 142 nodes · 187 edges · 12 communities (8 shown, 4 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.92)
- Token cost: 56,000 input · 6,003 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Express Server & Routing|Express Server & Routing]]
- [[_COMMUNITY_Architecture & Design Decisions|Architecture & Design Decisions]]
- [[_COMMUNITY_Lecture Processing Pipeline|Lecture Processing Pipeline]]
- [[_COMMUNITY_Note Generator (AST)|Note Generator (AST)]]
- [[_COMMUNITY_Lecture Processor (AST)|Lecture Processor (AST)]]
- [[_COMMUNITY_Job Manager (AST)|Job Manager (AST)]]
- [[_COMMUNITY_AI Backend & Notes Generation|AI Backend & Notes Generation]]
- [[_COMMUNITY_Job Lifecycle & Progress|Job Lifecycle & Progress]]
- [[_COMMUNITY_Video Processor (AST)|Video Processor (AST)]]
- [[_COMMUNITY_ffmpeg Resilience|ffmpeg Resilience]]
- [[_COMMUNITY_Graphify Integration|Graphify Integration]]
- [[_COMMUNITY_JobManager Module|JobManager Module]]

## God Nodes (most connected - your core abstractions)
1. `runVideoTrack` - 10 edges
2. `runNotesTrack` - 8 edges
3. `lectureProcessor.processLecture` - 7 edges
4. `transcribe (backend router)` - 6 edges
5. `noteGenerator.generateNotes` - 6 edges
6. `transcribe()` - 5 edges
7. `update()` - 4 edges
8. `runNotesTrack()` - 4 edges
9. `processLecture()` - 4 edges
10. `saveSettings()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `GyanBrige Platform (Live edtech)` --references--> `Transcription Server (Express App)`  [INFERRED]
  GyanBrige/CLAUDE.md → GyanBrige/backend/transcriptionServer.js
- `processTranscriptionJob (in-memory)` --semantically_similar_to--> `lectureProcessor.processLecture`  [INFERRED] [semantically similar]
  GyanBrige/backend/transcriptionServer.js → GyanBrige/backend/services/lectureProcessor.js
- `GyanBrige Platform (Live edtech)` --conceptually_related_to--> `English/Hindi/Marathi Multilingual Lecture Support`  [INFERRED]
  GyanBrige/CLAUDE.md → GyanBrige/backend/services/noteGenerator.js
- `transcribeWithProgress (direct OpenAI Whisper)` --semantically_similar_to--> `transcribeWithOpenAI`  [INFERRED] [semantically similar]
  GyanBrige/backend/services/lectureProcessor.js → GyanBrige/backend/transcriptionServer.js
- `Pluggable Whisper Backend (OpenAI/Ollama/local)` --semantically_similar_to--> `Toggleable AI Backend with Automatic Fallback`  [INFERRED] [semantically similar]
  GyanBrige/backend/transcriptionServer.js → GyanBrige/backend/services/noteGenerator.js

## Hyperedges (group relationships)
- **Parallel Lecture Processing Flow (upload to dual-track output)** — transcriptionServer_postLecturesProcessRoute, lectureProcessor_processLecture, lectureProcessor_runVideoTrack, lectureProcessor_runNotesTrack, jobManager_createJob, videoProcessor_extractAudio, noteGenerator_generateNotes [INFERRED 0.95]
- **Job Progress + Status Roll-up across Tracks** — jobManager_setProgress, jobManager_complete, jobManager_fail, jobManager_update, jobManager_JobShape [INFERRED 0.85]
- **Swappable AI Backends (transcription + notes)** — transcriptionServer_transcribeWithOpenAI, transcriptionServer_transcribeWithOllama, transcriptionServer_transcribeWithLocal, noteGenerator_generateWithChatGPT, noteGenerator_generateWithOllama, noteGenerator_USE_LOCAL_AI [INFERRED 0.85]

## Communities (12 total, 4 thin omitted)

### Community 0 - "Express Server & Routing"
Cohesion: 0.08
Nodes (26): app, CONFIG, cors, express, fs, interval, job, jobId (+18 more)

### Community 1 - "Architecture & Design Decisions"
Cohesion: 0.14
Nodes (18): GyanBrige CLAUDE.md (stack + wiki rules), Toggleable AI Backend with Automatic Fallback, Credit Discipline (minimal speculative reads), English/Hindi/Marathi Multilingual Lecture Support, Pluggable Whisper Backend (OpenAI/Ollama/local), Tiered Wiki Query (Hot/Standard/Deep), Wiki Vault Knowledge Base, GyanBrige Platform (Live edtech) (+10 more)

### Community 2 - "Lecture Processing Pipeline"
Cohesion: 0.18
Nodes (17): Parallel Video+Notes Track Pipeline, jobManager.complete, jobManager.fail, jobManager.setProgress, jobManager.update (internal status roll-up), PROCESSED_DIR (backend/processed), audioPromises (per-job audio promise cache), getOrExtractAudio (shared audio cache) (+9 more)

### Community 3 - "Note Generator (AST)"
Cohesion: 0.21
Nodes (13): CONFIG, fs, generateNotes(), generateWithChatGPT(), generateWithOllama(), getConfig(), getPromptForType(), parseAIResponse() (+5 more)

### Community 4 - "Lecture Processor (AST)"
Cohesion: 0.18
Nodes (13): audioPromises, fs, getOrExtractAudio(), isVideo(), jobs, noteGenerator, path, PROCESSED_DIR (+5 more)

### Community 5 - "Job Manager (AST)"
Cohesion: 0.23
Nodes (8): complete(), createJob(), fail(), jobs, setProgress(), TRACK_DEFAULTS(), update(), { v4: uuidv4 }

### Community 6 - "AI Backend & Notes Generation"
Cohesion: 0.2
Nodes (12): NOTES_PROMPT (multilingual JSON schema prompt), USE_LOCAL_AI (global backend toggle), noteGenerator.generateNotes, generateWithChatGPT, generateWithOllama, getPromptForType, loadSettings/saveSettings (ai-settings.json), parseAIResponse (JSON-or-text fallback) (+4 more)

### Community 7 - "Job Lifecycle & Progress"
Cohesion: 0.31
Nodes (9): Progress Reporting via Polling + SSE, Job Data Shape (video+notes tracks), jobManager.cleanup (60min TTL), jobManager.createJob, jobManager.getJob, jobs (in-memory Map), cleanupOriginal (post-tracks file cleanup), GET /api/lectures/process/status/:jobId (+1 more)

## Knowledge Gaps
- **50 isolated node(s):** `express`, `multer`, `cors`, `path`, `fs` (+45 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `lectureProcessor.processLecture` connect `Lecture Processing Pipeline` to `Architecture & Design Decisions`, `Job Lifecycle & Progress`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `runNotesTrack` connect `Lecture Processing Pipeline` to `Architecture & Design Decisions`, `AI Backend & Notes Generation`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `noteGenerator.generateNotes` connect `AI Backend & Notes Generation` to `Architecture & Design Decisions`, `Lecture Processing Pipeline`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `lectureProcessor.processLecture` (e.g. with `Parallel Video+Notes Track Pipeline` and `processTranscriptionJob (in-memory)`) actually correct?**
  _`lectureProcessor.processLecture` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `express`, `multer`, `cors` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Express Server & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `Architecture & Design Decisions` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._