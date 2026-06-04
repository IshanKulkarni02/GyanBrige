/**
 * Lecture Processor
 * Runs video processing and AI notes generation in parallel,
 * reporting independent progress for each track via jobManager.
 */

const path = require('path');
const fs = require('fs');
const jobs = require('./jobManager');
const video = require('./videoProcessor');
const noteGenerator = require('./noteGenerator');

const PROCESSED_DIR = path.join(__dirname, '..', 'processed');
if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });

// Shared audio promise per job: the notes track waits on this
const audioPromises = new Map();

function isVideo(mime, name = '') {
  if (mime?.startsWith('video/')) return true;
  return /\.(mp4|mov|avi|mkv|webm)$/i.test(name);
}

async function getOrExtractAudio(jobId, filePath, fileType) {
  if (!audioPromises.has(jobId)) {
    const p = (async () => {
      if (fileType === 'audio') return filePath;
      jobs.setProgress(jobId, 'notes', 5, 'Extracting audio from video...');
      return video.extractAudio(filePath, PROCESSED_DIR, (pct) => {
        const mapped = 5 + (pct / 100) * 15;
        jobs.setProgress(jobId, 'notes', mapped, `Extracting audio... ${Math.round(pct)}%`);
      });
    })();
    audioPromises.set(jobId, p);
  }
  return audioPromises.get(jobId);
}

async function runVideoTrack(jobId, filePath, fileType, opts) {
  try {
    if (fileType === 'audio') {
      jobs.setProgress(jobId, 'video', 100, 'Audio file, no video processing needed.', 'complete');
      jobs.complete(jobId, 'video', { url: filePath, audioOnly: true });
      return;
    }

    jobs.setProgress(jobId, 'video', 5, 'Reading video metadata...');
    const meta = await video.probe(filePath);

    jobs.setProgress(jobId, 'video', 25, 'Generating thumbnail...');
    let thumbnail = null;
    try {
      thumbnail = await video.generateThumbnail(
        filePath,
        PROCESSED_DIR,
        Math.min(2, Math.max(0.5, meta.duration / 10))
      );
    } catch (e) {
      console.warn('[video] thumbnail failed:', e.message);
    }

    if (opts.transcode !== false && video.isAvailable()) {
      jobs.setProgress(jobId, 'video', 40, 'Optimizing for streaming (this is the slow step)...');
      const streamPath = await video.transcodeForStreaming(filePath, PROCESSED_DIR, (pct) => {
        const mapped = 40 + (pct / 100) * 55;
        jobs.setProgress(jobId, 'video', mapped, `Encoding H.264... ${Math.round(pct)}%`);
      });
      jobs.setProgress(jobId, 'video', 97, 'Finalizing video...');
      jobs.complete(jobId, 'video', {
        url: streamPath,
        thumbnail,
        duration: meta.duration,
        size: meta.size,
        format: meta.format,
      });
    } else {
      jobs.setProgress(jobId, 'video', 95, 'Finalizing (transcode skipped)...');
      jobs.complete(jobId, 'video', {
        url: filePath,
        thumbnail,
        duration: meta.duration,
        size: meta.size,
        format: meta.format,
      });
    }
  } catch (err) {
    console.error('[video track] error:', err);
    jobs.fail(jobId, 'video', err);
  }
}

async function runNotesTrack(jobId, filePath, fileType, opts) {
  try {
    const audioPath = await getOrExtractAudio(jobId, filePath, fileType);

    jobs.setProgress(jobId, 'notes', 25, 'Sending audio to Whisper...');
    const transcript = await transcribeWithProgress(jobId, audioPath, opts.language);

    if (!transcript?.text) {
      throw new Error('Empty transcript returned from Whisper');
    }

    jobs.setProgress(
      jobId,
      'notes',
      70,
      `Transcribed ${transcript.text.length} chars. AI is writing notes...`
    );

    const notes = await noteGenerator.generateNotes(transcript.text, {
      type: opts.notesType || 'full',
    });

    jobs.setProgress(jobId, 'notes', 95, 'Finalizing notes...');

    jobs.complete(jobId, 'notes', {
      transcript: transcript.text,
      language: transcript.language,
      duration: transcript.duration,
      segments: transcript.segments,
      notes,
    });
  } catch (err) {
    console.error('[notes track] error:', err);
    jobs.fail(jobId, 'notes', err);
  }
}

async function transcribeWithProgress(jobId, audioPath, language) {
  // The current transcriptionServer exposes transcribe() locally; we re-implement
  // a lightweight call here against OpenAI directly to avoid HTTP roundtrip.
  const OpenAI = require('openai');
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const openai = new OpenAI({ apiKey });

  jobs.setProgress(jobId, 'notes', 35, 'Whisper is listening...');
  const start = Date.now();

  const stream = fs.createReadStream(audioPath);
  const opts = {
    file: stream,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  };
  if (language && language !== 'mixed') opts.language = language;

  const result = await openai.audio.transcriptions.create(opts);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  jobs.setProgress(jobId, 'notes', 60, `Whisper finished in ${elapsed}s.`);

  return {
    text: result.text,
    language: result.language,
    duration: result.duration,
    segments: result.segments || [],
  };
}

async function cleanupOriginal(jobId, filePath) {
  const job = jobs.getJob(jobId);
  if (!job) return;

  // Only delete the original upload if the video track produced a separate
  // file (transcode/audio-only). If the video track is still pointing at the
  // original, move it into processed/ first so we don't break the URL.
  const videoUrl = job.video.output?.url;
  const audioOnly = job.video.output?.audioOnly;

  try {
    if (audioOnly) {
      // For audio uploads, the file IS the asset. Move it into processed/
      // so the original uploads dir stays clean.
      const moved = path.join(PROCESSED_DIR, path.basename(filePath));
      if (filePath !== moved && fs.existsSync(filePath)) {
        fs.renameSync(filePath, moved);
        if (job.video.output) job.video.output.url = moved;
      }
      return;
    }

    if (videoUrl && videoUrl === filePath) {
      // Transcode was skipped; preserve original by moving it into processed/.
      const moved = path.join(PROCESSED_DIR, path.basename(filePath));
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, moved);
        if (job.video.output) job.video.output.url = moved;
      }
      return;
    }

    // Transcoded copy exists (or video failed but track is done) — safe to delete.
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[cleanup] deleted original upload: ${path.basename(filePath)}`);
    }
  } catch (e) {
    console.warn('[cleanup] failed:', e.message);
  }
}

async function processLecture({ filePath, mimeType, originalName, language, transcode, notesType, meta }) {
  const fileType = isVideo(mimeType, originalName) ? 'video' : 'audio';
  const job = jobs.createJob({ originalName, mimeType, fileType, ...meta });

  // Fire and forget — both tracks run in parallel.
  // Once BOTH have settled (success or failure), delete the original upload.
  Promise.allSettled([
    runVideoTrack(job.id, filePath, fileType, { transcode }),
    runNotesTrack(job.id, filePath, fileType, { language, notesType }),
  ])
    .then(() => cleanupOriginal(job.id, filePath))
    .catch((e) => console.error('[lectureProcessor] unexpected:', e))
    .finally(() => audioPromises.delete(job.id));

  return job;
}

module.exports = {
  processLecture,
};
