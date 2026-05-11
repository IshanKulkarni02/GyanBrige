/**
 * Transcription Server
 * Express API for audio transcription using OpenAI Whisper
 * Supports: OpenAI API, Local Whisper via Ollama, or whisper.cpp
 * Languages: English, Hindi, Marathi (and mixed)
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Import services
const noteGenerator = require('./services/noteGenerator');
const lectureProcessor = require('./services/lectureProcessor');
const jobManager = require('./services/jobManager');
const livekitEgress = require('./services/livekitEgress');

const app = express();
const PORT = process.env.PORT || process.env.TRANSCRIPTION_PORT || 4001;

// Configuration
const CONFIG = {
  // Choose transcription backend: 'openai', 'ollama', or 'local'
  backend: process.env.WHISPER_BACKEND || 'openai',
  
  // OpenAI API settings
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'whisper-1',
  },
  
  // Ollama settings (for local Whisper)
  ollama: {
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: 'whisper',
  },
  
  // Local whisper.cpp settings
  local: {
    modelPath: process.env.WHISPER_MODEL_PATH || './models/ggml-large-v3.bin',
    executable: process.env.WHISPER_EXECUTABLE || 'whisper',
  },
  
  // File storage
  uploadDir: path.join(__dirname, 'uploads'),
  maxFileSize: 500 * 1024 * 1024, // 500MB (videos)
};

// Ensure upload directory exists
if (!fs.existsSync(CONFIG.uploadDir)) {
  fs.mkdirSync(CONFIG.uploadDir, { recursive: true });
}

// Middleware - CORS configured for local network access
app.use(cors({
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CONFIG.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: CONFIG.maxFileSize },
  fileFilter: (req, file, cb) => {
    const audioOk = file.mimetype?.startsWith('audio/') ||
      /\.(wav|mp3|webm|ogg|m4a|aac|flac)$/i.test(file.originalname);
    const videoOk = file.mimetype?.startsWith('video/') ||
      /\.(mp4|mov|avi|mkv|webm)$/i.test(file.originalname);
    if (audioOk || videoOk) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported: audio (mp3/wav/m4a/...) and video (mp4/mov/...)'));
    }
  },
});

// Language mapping
const LANGUAGE_MAP = {
  en: 'english',
  hi: 'hindi',
  mr: 'marathi',
  mixed: null, // Auto-detect
};

// ============ TRANSCRIPTION BACKENDS ============

/**
 * Transcribe using OpenAI Whisper API
 */
async function transcribeWithOpenAI(filePath, language) {
  const OpenAI = require('openai');
  
  if (!CONFIG.openai.apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey: CONFIG.openai.apiKey });
  
  const transcriptionOptions = {
    file: fs.createReadStream(filePath),
    model: CONFIG.openai.model,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment', 'word'],
  };

  // Add language hint if specified (not for mixed)
  if (language && language !== 'mixed' && LANGUAGE_MAP[language]) {
    transcriptionOptions.language = language;
  }

  console.log(`[OpenAI] Transcribing with language: ${language || 'auto-detect'}`);
  
  const response = await openai.audio.transcriptions.create(transcriptionOptions);
  
  return {
    text: response.text,
    segments: response.segments?.map(seg => ({
      id: seg.id,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      words: seg.words,
    })) || [],
    language: response.language,
    duration: response.duration,
  };
}

/**
 * Transcribe using Ollama (local Whisper model)
 */
async function transcribeWithOllama(filePath, language) {
  const fetch = require('node-fetch');
  
  // Convert audio to base64
  const audioBuffer = fs.readFileSync(filePath);
  const audioBase64 = audioBuffer.toString('base64');
  
  const prompt = language && language !== 'mixed' 
    ? `Transcribe this audio. The language is ${LANGUAGE_MAP[language] || language}.`
    : 'Transcribe this audio. Detect the language automatically.';

  console.log(`[Ollama] Transcribing with prompt: ${prompt}`);

  const response = await fetch(`${CONFIG.ollama.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.ollama.model,
      prompt,
      images: [audioBase64], // Ollama uses 'images' for media input
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const result = await response.json();
  
  return {
    text: result.response,
    segments: [], // Ollama doesn't provide segments by default
    language: language || 'detected',
    duration: null,
  };
}

/**
 * Transcribe using local whisper.cpp
 */
async function transcribeWithLocal(filePath, language) {
  const { execSync } = require('child_process');
  
  const outputPath = filePath.replace(/\.[^.]+$/, '.json');
  
  let cmd = `${CONFIG.local.executable} -m ${CONFIG.local.modelPath} -f "${filePath}" -oj -of "${outputPath.replace('.json', '')}"`;
  
  // Add language flag if specified
  if (language && language !== 'mixed' && LANGUAGE_MAP[language]) {
    cmd += ` -l ${language}`;
  }

  console.log(`[Local] Running: ${cmd}`);
  
  try {
    execSync(cmd, { encoding: 'utf-8' });
    
    // Read the JSON output
    const jsonOutput = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    
    // Cleanup
    fs.unlinkSync(outputPath);
    
    return {
      text: jsonOutput.transcription?.map(s => s.text).join(' ') || '',
      segments: jsonOutput.transcription?.map((seg, idx) => ({
        id: idx,
        start: seg.timestamps?.from ? parseTimestamp(seg.timestamps.from) : 0,
        end: seg.timestamps?.to ? parseTimestamp(seg.timestamps.to) : 0,
        text: seg.text,
      })) || [],
      language: jsonOutput.language || language,
      duration: jsonOutput.duration,
    };
  } catch (error) {
    console.error('Local whisper error:', error);
    throw new Error(`Local transcription failed: ${error.message}`);
  }
}

// Helper to parse timestamp string to seconds
function parseTimestamp(ts) {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseFloat(ts) || 0;
}

/**
 * Main transcription function - routes to appropriate backend
 */
async function transcribe(filePath, language) {
  const startTime = Date.now();
  
  let result;
  switch (CONFIG.backend) {
    case 'openai':
      result = await transcribeWithOpenAI(filePath, language);
      break;
    case 'ollama':
      result = await transcribeWithOllama(filePath, language);
      break;
    case 'local':
      result = await transcribeWithLocal(filePath, language);
      break;
    default:
      throw new Error(`Unknown backend: ${CONFIG.backend}`);
  }
  
  result.processingTime = Date.now() - startTime;
  result.model = CONFIG.backend === 'openai' ? CONFIG.openai.model : CONFIG.backend;
  
  return result;
}

// ============ API ROUTES ============

/**
 * POST /api/transcribe
 * Upload and transcribe audio file
 */
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { language = 'mixed', timestamps = 'true' } = req.body;
    const filePath = req.file.path;

    console.log(`\n[Transcription] Started`);
    console.log(`  File: ${req.file.originalname}`);
    console.log(`  Size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Language: ${language}`);
    console.log(`  Backend: ${CONFIG.backend}`);

    // Perform transcription
    const result = await transcribe(filePath, language);

    // Cleanup uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete uploaded file:', err);
    });

    const totalTime = Date.now() - startTime;
    console.log(`[Transcription] Complete in ${totalTime}ms`);
    console.log(`  Text length: ${result.text.length} chars`);
    console.log(`  Segments: ${result.segments.length}`);

    res.json({
      success: true,
      text: result.text,
      segments: result.segments,
      language: result.language,
      duration: result.duration,
      model: result.model,
      processingTime: result.processingTime,
    });

  } catch (error) {
    console.error('[Transcription] Error:', error);
    
    // Cleanup file on error
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/transcribe/upload
 * Upload audio for streaming transcription
 */
app.post('/api/transcribe/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const jobId = uuidv4();
    const { language = 'mixed' } = req.body;

    // Store job info (in production, use Redis or a database)
    global.transcriptionJobs = global.transcriptionJobs || {};
    global.transcriptionJobs[jobId] = {
      filePath: req.file.path,
      language,
      status: 'pending',
      createdAt: Date.now(),
    };

    // Start transcription in background
    processTranscriptionJob(jobId);

    res.json({
      success: true,
      jobId,
      message: 'Transcription started',
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/transcribe/status/:jobId
 * Get transcription job status
 */
app.get('/api/transcribe/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = global.transcriptionJobs?.[jobId];

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId,
    status: job.status,
    progress: job.progress || 0,
    result: job.result,
    error: job.error,
  });
});

/**
 * Background job processor
 */
async function processTranscriptionJob(jobId) {
  const job = global.transcriptionJobs[jobId];
  if (!job) return;

  try {
    job.status = 'processing';
    job.progress = 10;

    const result = await transcribe(job.filePath, job.language);

    job.status = 'complete';
    job.progress = 100;
    job.result = result;

    // Cleanup file
    fs.unlink(job.filePath, () => {});

  } catch (error) {
    job.status = 'error';
    job.error = error.message;
    
    // Cleanup file
    if (job.filePath) fs.unlink(job.filePath, () => {});
  }
}

/**
 * POST /api/notes/generate
 * Generate structured notes from transcription using AI.
 * Accepts `outputLanguage` (e.g. 'en', 'hi', 'mr') to control the language
 * of the produced notes regardless of the transcript's source language(s).
 */
app.post('/api/notes/generate', async (req, res) => {
  try {
    const {
      transcript,
      text, // alias for transcript
      type = 'full',
      outputLanguage = 'en',
      forceLocal,
      forceRemote,
    } = req.body;

    const transcriptText = transcript || text;
    if (!transcriptText) {
      return res.status(400).json({ success: false, error: 'Transcript text is required' });
    }

    console.log(
      `[Notes] Generating ${type} notes in ${outputLanguage} for ${transcriptText.length} chars`,
    );

    const result = await noteGenerator.generateNotes(transcriptText, {
      type,
      outputLanguage,
      forceLocal,
      forceRemote,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Notes] Generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/config
 * Get current AI configuration
 */
app.get('/api/ai/config', (req, res) => {
  res.json({
    success: true,
    config: noteGenerator.getConfig(),
  });
});

/**
 * PUT /api/ai/config
 * Update AI configuration (admin only)
 */
app.put('/api/ai/config', (req, res) => {
  try {
    const { useLocalAI, openaiModel, ollamaModel } = req.body;
    
    const updatedConfig = noteGenerator.updateConfig({
      useLocalAI,
      openaiModel,
      ollamaModel,
    });

    res.json({
      success: true,
      config: updatedConfig,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/ai/toggle
 * Toggle between local and remote AI
 */
app.post('/api/ai/toggle', (req, res) => {
  const useLocalAI = noteGenerator.toggleLocalAI();
  
  res.json({
    success: true,
    useLocalAI,
    message: `Switched to ${useLocalAI ? 'Ollama (Local)' : 'ChatGPT (OpenAI)'}`,
  });
});

/**
 * POST /api/ai/test
 * Test connection to AI backend
 */
app.post('/api/ai/test', async (req, res) => {
  try {
    const { backend } = req.body; // 'openai', 'ollama', or null for current
    
    const result = await noteGenerator.testConnection(backend);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/lectures/process
 * Upload a lecture file. Runs video processing + AI notes generation in parallel.
 * Returns a jobId immediately; client polls /status/:jobId for progress.
 */
app.post('/api/lectures/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const {
      title,
      subjectId,
      description,
      language = 'mixed',
      transcode = 'true',
      notesType = 'full',
    } = req.body;

    const job = await lectureProcessor.processLecture({
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      language,
      transcode: transcode !== 'false',
      notesType,
      meta: { title, subjectId, description },
    });

    res.json({
      success: true,
      jobId: job.id,
      message: 'Processing started. Poll /api/lectures/process/status/:jobId for updates.',
    });
  } catch (error) {
    console.error('[lectures/process] error:', error);
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/lectures/process/status/:jobId
 * Returns current state of both tracks.
 */
app.get('/api/lectures/process/status/:jobId', (req, res) => {
  const job = jobManager.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.json({
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    meta: job.meta,
    video: {
      status: job.video.status,
      progress: Math.round(job.video.progress),
      step: job.video.step,
      output: job.video.output,
      error: job.video.error,
      durationMs: job.video.finishedAt && job.video.startedAt
        ? job.video.finishedAt - job.video.startedAt : null,
    },
    notes: {
      status: job.notes.status,
      progress: Math.round(job.notes.progress),
      step: job.notes.step,
      output: job.notes.output,
      error: job.notes.error,
      durationMs: job.notes.finishedAt && job.notes.startedAt
        ? job.notes.finishedAt - job.notes.startedAt : null,
    },
  });
});

/**
 * GET /api/lectures/process/stream/:jobId
 * Server-Sent Events stream of status updates. Useful for web clients.
 */
app.get('/api/lectures/process/stream/:jobId', (req, res) => {
  const job = jobManager.getJob(req.params.jobId);
  if (!job) return res.status(404).end();

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  const send = () => {
    const j = jobManager.getJob(req.params.jobId);
    if (!j) return;
    res.write(`data: ${JSON.stringify({
      status: j.status,
      video: { status: j.video.status, progress: Math.round(j.video.progress), step: j.video.step },
      notes: { status: j.notes.status, progress: Math.round(j.notes.progress), step: j.notes.step },
    })}\n\n`);
    if (j.status === 'complete' || j.status === 'error' || j.status === 'partial') {
      clearInterval(interval);
      res.end();
    }
  };

  const interval = setInterval(send, 500);
  send();
  req.on('close', () => clearInterval(interval));
});

/**
 * POST /api/livekit/egress
 * Receives a LiveKit Egress webhook (recording finished) and hands the file
 * to the existing lectureProcessor (parallel video+notes tracks).
 * The webhook caller (the api service) is expected to attach `lectureId`
 * via metadata so the API can later attach the produced jobId to the lecture.
 */
app.post('/api/livekit/egress', express.json({ limit: '2mb' }), async (req, res) => {
  try {
    const job = await livekitEgress.handleEgressEvent(req.body, { lectureProcessor });
    res.json({ success: true, jobId: job?.id ?? null });
  } catch (error) {
    console.error('[livekit/egress] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    backend: CONFIG.backend,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: error.message,
  });
});

// Get local IP address for display
const getLocalIP = () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

// Start server - bind to 0.0.0.0 to allow local network access
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log(`
🎙️  Transcription Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   🌐 Network Access:
   ─────────────────
   Local:      http://localhost:${PORT}
   Network:    http://${localIP}:${PORT}

   ⚙️  Configuration:
   ─────────────────
   Backend:    ${CONFIG.backend}
   Upload Dir: ${CONFIG.uploadDir}
   AI Backend: ${noteGenerator.USE_LOCAL_AI ? '🦙 Ollama (Local)' : '🤖 ChatGPT (OpenAI)'}

   📱 To connect from mobile device:
   ─────────────────────────────────
   1. Ensure phone is on same Wi-Fi network
   2. Update src/config/network.js:
      const SERVER_IP = '${localIP}';
   3. Restart Expo app

   📡 API Endpoints:
   ─────────────────
   POST /api/transcribe          - Upload & transcribe audio
   POST /api/notes/generate      - Generate AI notes
   GET  /api/ai/config           - Get AI configuration
   PUT  /api/ai/config           - Update AI configuration
   POST /api/ai/toggle           - Toggle local/remote AI
   POST /api/ai/test             - Test AI connection
   GET  /api/health              - Health check

   Languages: English, Hindi, Marathi, Mixed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

module.exports = app;
