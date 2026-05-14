/**
 * Video Processor - HLS Converter
 * Converts uploaded videos to HLS format with 20-second segments
 * for YouTube-like seeking capability
 */

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');

// Configuration
const CONFIG = {
  segmentDuration: 20, // 20-second chunks
  mediaDir: path.join(__dirname, '..', 'media'),
  serverPort: 8080,
};

/**
 * Get local network IP address
 */
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Ensure media directory exists
 */
function ensureMediaDir(videoId) {
  const videoDir = path.join(CONFIG.mediaDir, videoId);
  if (!fs.existsSync(CONFIG.mediaDir)) {
    fs.mkdirSync(CONFIG.mediaDir, { recursive: true });
  }
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }
  return videoDir;
}

/**
 * Process video to HLS format
 * @param {string} inputPath - Path to the input video file
 * @param {string} videoId - Unique identifier for the video (used for output folder)
 * @returns {Promise<object>} - Processing result with output paths
 */
function processVideoToHLS(inputPath, videoId) {
  return new Promise((resolve, reject) => {
    // Validate input file exists
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file not found: ${inputPath}`));
    }

    const outputDir = ensureMediaDir(videoId);
    const outputPath = path.join(outputDir, 'playlist.m3u8');
    const segmentPath = path.join(outputDir, 'segment_%03d.ts');

    console.log('\n🎬 Starting video processing...');
    console.log(`   Input: ${inputPath}`);
    console.log(`   Output: ${outputDir}`);
    console.log(`   Segment duration: ${CONFIG.segmentDuration}s\n`);

    ffmpeg(inputPath)
      // Video codec settings
      .videoCodec('libx264')
      .addOption('-preset', 'fast') // Encoding speed (ultrafast, fast, medium, slow)
      .addOption('-crf', '23') // Quality (0-51, lower = better)
      
      // Audio codec settings
      .audioCodec('aac')
      .audioBitrate('128k')
      .audioChannels(2)
      
      // HLS specific options
      .addOption('-hls_time', CONFIG.segmentDuration) // Segment duration
      .addOption('-hls_list_size', '0') // Keep all segments in playlist
      .addOption('-hls_segment_filename', segmentPath)
      .addOption('-hls_playlist_type', 'vod') // Video on demand
      
      // Additional options for better compatibility
      .addOption('-movflags', '+faststart') // Enable fast start for web playback
      .addOption('-pix_fmt', 'yuv420p') // Pixel format for compatibility
      .addOption('-profile:v', 'main') // H.264 profile
      .addOption('-level', '4.0') // H.264 level
      
      // Output format
      .format('hls')
      .output(outputPath)
      
      // Event handlers
      .on('start', (commandLine) => {
        console.log('📟 FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          const percent = Math.round(progress.percent);
          const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
          process.stdout.write(`\r   Processing: [${bar}] ${percent}%`);
        }
      })
      .on('end', () => {
        console.log('\n\n✅ Processing complete!');
        
        // Count generated segments
        const segments = fs.readdirSync(outputDir).filter(f => f.endsWith('.ts'));
        
        const result = {
          success: true,
          videoId,
          outputDir,
          playlistPath: outputPath,
          playlistUrl: `/media/${videoId}/playlist.m3u8`,
          segmentCount: segments.length,
          segmentDuration: CONFIG.segmentDuration,
        };
        
        console.log(`   Segments created: ${segments.length}`);
        console.log(`   Playlist: ${outputPath}`);
        
        resolve(result);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('\n❌ Error processing video:', err.message);
        console.error('FFmpeg stderr:', stderr);
        reject(err);
      })
      .run();
  });
}

/**
 * Process video with multiple quality levels (adaptive bitrate)
 */
function processVideoMultiQuality(inputPath, videoId) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) {
      return reject(new Error(`Input file not found: ${inputPath}`));
    }

    const outputDir = ensureMediaDir(videoId);
    
    const qualities = [
      { name: '360p', width: 640, height: 360, bitrate: '800k' },
      { name: '480p', width: 854, height: 480, bitrate: '1400k' },
      { name: '720p', width: 1280, height: 720, bitrate: '2800k' },
    ];

    console.log('\n🎬 Starting multi-quality video processing...');
    console.log(`   Input: ${inputPath}`);
    console.log(`   Output: ${outputDir}`);
    console.log(`   Qualities: ${qualities.map(q => q.name).join(', ')}\n`);

    const processQuality = (quality) => {
      return new Promise((res, rej) => {
        const qualityDir = path.join(outputDir, quality.name);
        if (!fs.existsSync(qualityDir)) {
          fs.mkdirSync(qualityDir, { recursive: true });
        }

        const outputPath = path.join(qualityDir, 'playlist.m3u8');
        const segmentPath = path.join(qualityDir, 'segment_%03d.ts');

        console.log(`   Processing ${quality.name}...`);

        ffmpeg(inputPath)
          .videoCodec('libx264')
          .size(`${quality.width}x${quality.height}`)
          .videoBitrate(quality.bitrate)
          .addOption('-preset', 'fast')
          .audioCodec('aac')
          .audioBitrate('128k')
          .addOption('-hls_time', CONFIG.segmentDuration)
          .addOption('-hls_list_size', '0')
          .addOption('-hls_segment_filename', segmentPath)
          .addOption('-hls_playlist_type', 'vod')
          .format('hls')
          .output(outputPath)
          .on('end', () => {
            console.log(`   ✓ ${quality.name} complete`);
            res({ quality: quality.name, playlist: outputPath });
          })
          .on('error', rej)
          .run();
      });
    };

    // Process all qualities sequentially
    Promise.all(qualities.map(processQuality))
      .then((results) => {
        // Create master playlist
        const masterPlaylist = generateMasterPlaylist(videoId, qualities);
        const masterPath = path.join(outputDir, 'master.m3u8');
        fs.writeFileSync(masterPath, masterPlaylist);

        console.log('\n✅ Multi-quality processing complete!');
        resolve({
          success: true,
          videoId,
          masterPlaylist: `/media/${videoId}/master.m3u8`,
          qualities: results,
        });
      })
      .catch(reject);
  });
}

/**
 * Generate master playlist for adaptive streaming
 */
function generateMasterPlaylist(videoId, qualities) {
  const bandwidths = { '360p': 800000, '480p': 1400000, '720p': 2800000 };
  
  let playlist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
  
  qualities.forEach((q) => {
    playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidths[q.name]},RESOLUTION=${q.width}x${q.height}\n`;
    playlist += `${q.name}/playlist.m3u8\n\n`;
  });
  
  return playlist;
}

/**
 * Start HTTP server to serve HLS content
 */
function startMediaServer() {
  const mimeTypes = {
    '.m3u8': 'application/vnd.apple.mpegurl',
    '.ts': 'video/MP2T',
    '.mp4': 'video/mp4',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
  };

  const server = http.createServer((req, res) => {
    // Enable CORS for local network access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    let filePath = req.url === '/' 
      ? path.join(__dirname, 'player.html')
      : path.join(CONFIG.mediaDir, '..', req.url);

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end('Server error');
        }
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });

  const localIP = getLocalIP();
  
  server.listen(CONFIG.serverPort, '0.0.0.0', () => {
    console.log('\n🌐 Media server running!');
    console.log(`   Local:   http://localhost:${CONFIG.serverPort}`);
    console.log(`   Network: http://${localIP}:${CONFIG.serverPort}`);
    console.log('\n   Example stream URL:');
    console.log(`   http://${localIP}:${CONFIG.serverPort}/media/{videoId}/playlist.m3u8\n`);
  });

  return server;
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'process':
      const inputFile = args[1];
      const videoId = args[2] || `video_${Date.now()}`;
      
      if (!inputFile) {
        console.log('Usage: node videoProcessor.js process <input-file> [video-id]');
        process.exit(1);
      }
      
      processVideoToHLS(inputFile, videoId)
        .then((result) => {
          console.log('\n📺 Stream URL:');
          console.log(`   http://${getLocalIP()}:${CONFIG.serverPort}${result.playlistUrl}`);
        })
        .catch(console.error);
      break;

    case 'process-multi':
      const inputMulti = args[1];
      const videoIdMulti = args[2] || `video_${Date.now()}`;
      
      if (!inputMulti) {
        console.log('Usage: node videoProcessor.js process-multi <input-file> [video-id]');
        process.exit(1);
      }
      
      processVideoMultiQuality(inputMulti, videoIdMulti)
        .then((result) => {
          console.log('\n📺 Master playlist URL:');
          console.log(`   http://${getLocalIP()}:${CONFIG.serverPort}${result.masterPlaylist}`);
        })
        .catch(console.error);
      break;

    case 'serve':
      startMediaServer();
      break;

    default:
      console.log(`
📹 Video Processor - HLS Converter

Commands:
  process <input> [id]       Convert video to HLS (single quality)
  process-multi <input> [id] Convert video to HLS (multiple qualities)
  serve                      Start media server

Examples:
  node videoProcessor.js process ./video.mp4 my-lecture
  node videoProcessor.js process-multi ./video.mp4 my-lecture
  node videoProcessor.js serve
      `);
  }
}

// Export for use as module
module.exports = {
  processVideoToHLS,
  processVideoMultiQuality,
  startMediaServer,
  CONFIG,
};
