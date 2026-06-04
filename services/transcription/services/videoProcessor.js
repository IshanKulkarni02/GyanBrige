/**
 * Video Processor
 * Wraps fluent-ffmpeg with progress callbacks.
 * Falls back gracefully when ffmpeg is not installed (audio-only flows still work).
 */

const path = require('path');
const fs = require('fs');

let ffmpeg = null;
let ffmpegAvailable = false;

try {
  ffmpeg = require('fluent-ffmpeg');
  try {
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    const ffprobePath = require('@ffprobe-installer/ffprobe').path;
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
  } catch (_) {
    // Use system-installed ffmpeg if installer packages are missing
  }
  ffmpegAvailable = true;
} catch (_) {
  console.warn('[videoProcessor] fluent-ffmpeg not installed. Video processing limited.');
}

function isAvailable() {
  return ffmpegAvailable;
}

function probe(filePath) {
  return new Promise((resolve, reject) => {
    if (!ffmpegAvailable) {
      const stat = fs.statSync(filePath);
      return resolve({ duration: 0, size: stat.size, format: null, streams: [] });
    }
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      resolve({
        duration: data.format?.duration || 0,
        size: data.format?.size || 0,
        format: data.format?.format_name || null,
        bitRate: data.format?.bit_rate || 0,
        streams: data.streams || [],
      });
    });
  });
}

function extractAudio(videoPath, outDir, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    if (!ffmpegAvailable) {
      return reject(new Error('ffmpeg required for audio extraction'));
    }
    const outPath = path.join(outDir, `${path.parse(videoPath).name}.mp3`);
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioChannels(1)
      .audioFrequency(16000)
      .on('progress', (p) => onProgress(p.percent || 0))
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .save(outPath);
  });
}

function generateThumbnail(videoPath, outDir, timeSec = 1) {
  return new Promise((resolve, reject) => {
    if (!ffmpegAvailable) {
      return resolve(null);
    }
    const outFile = `${path.parse(videoPath).name}-thumb.jpg`;
    ffmpeg(videoPath)
      .on('end', () => resolve(path.join(outDir, outFile)))
      .on('error', reject)
      .screenshots({
        timestamps: [timeSec],
        filename: outFile,
        folder: outDir,
        size: '480x?',
      });
  });
}

function transcodeForStreaming(videoPath, outDir, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    if (!ffmpegAvailable) {
      return resolve(videoPath);
    }
    const outPath = path.join(outDir, `${path.parse(videoPath).name}-stream.mp4`);
    ffmpeg(videoPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset veryfast',
        '-movflags +faststart',
        '-crf 26',
      ])
      .on('progress', (p) => onProgress(p.percent || 0))
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .save(outPath);
  });
}

module.exports = {
  isAvailable,
  probe,
  extractAudio,
  generateThumbnail,
  transcodeForStreaming,
};
