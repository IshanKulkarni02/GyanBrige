/**
 * Lecture auto-editor.
 * Pass 1: ffmpeg silencedetect → list of silence intervals.
 * Pass 2: transcript scan → filler-word + repetition windows.
 * Output: concat-cut MP4 with silent/filler stretches removed.
 *
 * Designed to run as a worker step. Heavy work is ffmpeg-bound; transcript
 * scoring is local (no LLM required) so this works fully offline.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let ffmpegPath = 'ffmpeg';
let ffprobePath = 'ffprobe';
try {
  ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
  ffprobePath = require('@ffprobe-installer/ffprobe').path;
} catch (_) {
  // use system ffmpeg
}

const FILLER_WORDS = [
  'um', 'uh', 'er', 'erm', 'hmm', 'like', 'you know', 'sort of', 'kind of',
  'basically', 'literally', 'actually', 'so yeah', 'right', 'okay so',
  'matlab', 'haina', 'samjha', 'theek hai', 'achha', 'bole toh', 'naa',
];

function detectSilences(videoPath, { minDb = -32, minDurSec = 1.4 } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-i', videoPath,
      '-af', `silencedetect=noise=${minDb}dB:d=${minDurSec}`,
      '-f', 'null',
      '-',
    ];
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', () => {
      const intervals = [];
      const startRe = /silence_start: ([\d.]+)/g;
      const endRe = /silence_end: ([\d.]+)/g;
      const starts = Array.from(stderr.matchAll(startRe)).map((m) => parseFloat(m[1]));
      const ends = Array.from(stderr.matchAll(endRe)).map((m) => parseFloat(m[1]));
      for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
        intervals.push({ start: starts[i], end: ends[i], reason: 'silence' });
      }
      resolve(intervals);
    });
    proc.on('error', reject);
  });
}

function detectFillerWindows(segments, padSec = 0.6) {
  if (!Array.isArray(segments)) return [];
  const windows = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    const t = seg.text.toLowerCase();
    const fillerOnly = FILLER_WORDS.some((f) => {
      // True if the entire segment is essentially a filler (short + matches)
      const clean = t.replace(/[.,!?]/g, '').trim();
      return clean === f || (clean.length < f.length + 3 && clean.includes(f));
    });
    if (fillerOnly) {
      windows.push({
        start: Math.max(0, seg.start - padSec),
        end: seg.end + padSec,
        reason: 'filler',
      });
    }
  }
  return windows;
}

function mergeIntervals(intervals, gapSec = 0.3) {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1];
    const cur = sorted[i];
    if (cur.start - prev.end <= gapSec) {
      prev.end = Math.max(prev.end, cur.end);
      prev.reason = `${prev.reason}+${cur.reason}`;
    } else {
      out.push(cur);
    }
  }
  return out;
}

async function ffprobeDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath]);
    let out = '';
    proc.stdout.on('data', (c) => { out += c.toString(); });
    proc.on('close', () => resolve(parseFloat(out.trim()) || 0));
    proc.on('error', reject);
  });
}

function buildKeepSegments(cuts, totalDur) {
  const keeps = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.start > cursor) keeps.push({ start: cursor, end: cut.start });
    cursor = Math.max(cursor, cut.end);
  }
  if (cursor < totalDur) keeps.push({ start: cursor, end: totalDur });
  return keeps.filter((k) => k.end - k.start > 0.3);
}

function buildFfmpegFilter(keeps) {
  // Each keep becomes [v0][a0]...[v0]trim,setpts;[a0]atrim,asetpts → concat.
  const filters = [];
  const labels = [];
  keeps.forEach((k, i) => {
    filters.push(`[0:v]trim=start=${k.start}:end=${k.end},setpts=PTS-STARTPTS[v${i}]`);
    filters.push(`[0:a]atrim=start=${k.start}:end=${k.end},asetpts=PTS-STARTPTS[a${i}]`);
    labels.push(`[v${i}][a${i}]`);
  });
  filters.push(`${labels.join('')}concat=n=${keeps.length}:v=1:a=1[outv][outa]`);
  return filters.join(';');
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = '';
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

async function autoEdit({ videoPath, segments, outPath }) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`Source not found: ${videoPath}`);
  }
  const [silences, totalDur] = await Promise.all([
    detectSilences(videoPath),
    ffprobeDuration(videoPath),
  ]);
  const fillers = detectFillerWindows(segments);
  const cuts = mergeIntervals([...silences, ...fillers]);
  const keeps = buildKeepSegments(cuts, totalDur);

  if (keeps.length === 0) throw new Error('Nothing left after editing');

  const out = outPath || path.join(path.dirname(videoPath), `${path.parse(videoPath).name}-edited.mp4`);
  const filter = buildFfmpegFilter(keeps);
  await runFfmpeg([
    '-y',
    '-i', videoPath,
    '-filter_complex', filter,
    '-map', '[outv]',
    '-map', '[outa]',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '24',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    out,
  ]);

  return {
    output: out,
    originalDuration: totalDur,
    editedDuration: keeps.reduce((s, k) => s + (k.end - k.start), 0),
    cutCount: cuts.length,
    cuts,
  };
}

module.exports = { autoEdit, detectSilences, detectFillerWindows };
