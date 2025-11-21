const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;

class VideoService {
  constructor() {
    this.segmentDuration = parseInt(process.env.HLS_SEGMENT_DURATION) || 10;
    this.outputPath = process.env.VIDEO_OUTPUT_PATH || './public/videos';
  }

  /**
   * Process uploaded video into HLS format with multiple quality options
   * Similar to YouTube's adaptive streaming
   */
  async processVideo(inputPath, videoId) {
    const outputDir = path.join(this.outputPath, videoId);
    await fs.mkdir(outputDir, { recursive: true });

    const qualities = [
      { name: '360p', width: 640, height: 360, bitrate: '800k', audioBitrate: '96k' },
      { name: '480p', width: 854, height: 480, bitrate: '1400k', audioBitrate: '128k' },
      { name: '720p', width: 1280, height: 720, bitrate: '2800k', audioBitrate: '128k' },
      { name: '1080p', width: 1920, height: 1080, bitrate: '5000k', audioBitrate: '192k' }
    ];

    try {
      // Process each quality variant
      const processingPromises = qualities.map(quality => 
        this.createHLSVariant(inputPath, outputDir, quality, videoId)
      );

      await Promise.all(processingPromises);

      // Create master playlist
      await this.createMasterPlaylist(outputDir, qualities);

      return {
        success: true,
        videoId,
        masterPlaylist: `${videoId}/master.m3u8`,
        qualities: qualities.map(q => q.name)
      };
    } catch (error) {
      console.error('Video processing error:', error);
      throw error;
    }
  }

  /**
   * Create HLS variant for a specific quality
   */
  createHLSVariant(inputPath, outputDir, quality, videoId) {
    return new Promise((resolve, reject) => {
      const outputFileName = `${quality.name}.m3u8`;
      const outputPath = path.join(outputDir, outputFileName);

      ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264',
          '-c:a aac',
          `-b:v ${quality.bitrate}`,
          `-b:a ${quality.audioBitrate}`,
          '-sc_threshold 0',
          '-g 48',
          '-keyint_min 48',
          `-s ${quality.width}x${quality.height}`,
          '-hls_time ' + this.segmentDuration,
          '-hls_playlist_type vod',
          `-hls_segment_filename ${path.join(outputDir, quality.name + '_%03d.ts')}`,
          '-f hls'
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log(`Processing ${quality.name}:`, cmd);
        })
        .on('progress', (progress) => {
          console.log(`${quality.name} progress: ${progress.percent?.toFixed(2)}%`);
        })
        .on('end', () => {
          console.log(`✅ ${quality.name} processing completed`);
          resolve();
        })
        .on('error', (err) => {
          console.error(`❌ Error processing ${quality.name}:`, err);
          reject(err);
        })
        .run();
    });
  }

  /**
   * Create master playlist that includes all quality variants
   */
  async createMasterPlaylist(outputDir, qualities) {
    let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    qualities.forEach(quality => {
      const bandwidth = parseInt(quality.bitrate) * 1000;
      masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.width}x${quality.height}\n`;
      masterPlaylist += `${quality.name}.m3u8\n\n`;
    });

    const masterPath = path.join(outputDir, 'master.m3u8');
    await fs.writeFile(masterPath, masterPlaylist);
    console.log('✅ Master playlist created');
  }

  /**
   * Get video metadata
   */
  getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
  }

  /**
   * Extract thumbnail from video
   */
  async extractThumbnail(videoPath, outputPath, timestamp = '00:00:01') {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: 'thumbnail.jpg',
          folder: outputPath,
          size: '640x360'
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });
  }
}

module.exports = new VideoService();
