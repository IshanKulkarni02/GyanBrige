/**
 * LiveKit Egress Handler
 *
 * Receives the LiveKit Egress webhook after a recording finishes.
 * Downloads the MP4 (if remote) and hands it to lectureProcessor.processLecture()
 * so the existing parallel video + notes pipeline kicks in. The returned jobId
 * is returned to the caller (the api service), which stores it on the Lecture row.
 *
 * Webhook payload shape (subset we care about):
 * {
 *   "event": "egress_ended",
 *   "egressInfo": {
 *     "egressId": "...",
 *     "roomName": "...",
 *     "status": "EGRESS_COMPLETE",
 *     "fileResults": [{ "filename": "...", "location": "https://.../lecture.mp4", "duration": ..., "size": ... }],
 *     "userMetadata": "{\"lectureId\":\"...\",\"language\":\"mixed\"}"
 *   }
 * }
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function downloadTo(srcUrl, destPath) {
  return new Promise((resolve, reject) => {
    const client = srcUrl.startsWith('https:') ? https : http;
    const out = fs.createWriteStream(destPath);
    client
      .get(srcUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed ${res.statusCode}`));
          return;
        }
        res.pipe(out);
        out.on('finish', () => out.close(resolve));
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => reject(err));
      });
  });
}

function parseUserMetadata(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function handleEgressEvent(body, { lectureProcessor }) {
  const eventName = body?.event || body?.eventName;
  if (eventName && eventName !== 'egress_ended') {
    return null;
  }

  const info = body?.egressInfo || body?.egress_info || body;
  const fileResult = info?.fileResults?.[0] || info?.file_results?.[0];
  if (!fileResult) throw new Error('No fileResults in egress webhook');

  const meta = parseUserMetadata(info.userMetadata || info.user_metadata);
  const lectureId = meta.lectureId || meta.lecture_id || null;
  const language = meta.language || 'mixed';
  const notesType = meta.notesType || 'full';

  const location = fileResult.location || fileResult.uri;
  const filename = fileResult.filename || `${crypto.randomBytes(8).toString('hex')}.mp4`;
  const localPath = path.join(UPLOADS_DIR, path.basename(filename));

  if (/^https?:\/\//.test(location)) {
    await downloadTo(location, localPath);
  } else if (fs.existsSync(location)) {
    fs.copyFileSync(location, localPath);
  } else {
    throw new Error(`Recording not accessible at ${location}`);
  }

  const job = await lectureProcessor.processLecture({
    filePath: localPath,
    mimeType: 'video/mp4',
    originalName: path.basename(filename),
    language,
    transcode: true,
    notesType,
    meta: { lectureId, source: 'livekit-egress', roomName: info.roomName },
  });

  if (lectureId && process.env.API_URL) {
    notifyApi(lectureId, job.id, localPath).catch((e) =>
      console.warn('[livekitEgress] api notify failed:', e.message),
    );
  }

  return job;
}

async function notifyApi(lectureId, jobId, filepath) {
  const url = `${process.env.API_URL.replace(/\/$/, '')}/api/livestreams/egress-webhook`;
  const fetchFn = global.fetch || require('node-fetch');
  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': process.env.INTERNAL_API_TOKEN || '',
    },
    body: JSON.stringify({ lectureId, jobId, recordingUrl: filepath }),
  });
  if (!res.ok) throw new Error(`api webhook ${res.status}`);
}

module.exports = { handleEgressEvent };
