const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

const Video = require('../models/Video');
const videoService = require('../services/videoService');
const ollamaService = require('../services/ollamaService');
const Notes = require('../models/Notes');

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = process.env.VIDEO_UPLOAD_PATH || './uploads/videos';
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

// Upload video (both live recording and pre-recorded)
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description, subject, lesson } = req.body;
    const videoId = uuidv4();
    const filePath = req.file.path;

    // Get video metadata
    const metadata = await videoService.getVideoMetadata(filePath);
    
    // Create video record
    const video = new Video({
      title: title || req.file.originalname,
      description: description || '',
      originalFileName: req.file.originalname,
      videoId: videoId,
      masterPlaylist: `${videoId}/master.m3u8`,
      fileSize: req.file.size,
      status: 'processing',
      subject: subject || null,
      lesson: lesson || '',
      metadata: {
        format: metadata.format.format_name,
        duration: metadata.format.duration
      }
    });

    await video.save();

    // Emit event for real-time update
    const io = req.app.get('io');
    io.emit('videoUploaded', { videoId, title, status: 'processing' });

    // Process video asynchronously
    processVideoAsync(filePath, videoId, video, io);

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully. Processing started.',
      video: {
        id: video._id,
        videoId: video.videoId,
        title: video.title,
        status: video.status
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload video: ' + error.message });
  }
});

// Process video asynchronously
async function processVideoAsync(filePath, videoId, video, io) {
  try {
    // Process video into HLS format
    const result = await videoService.processVideo(filePath, videoId);
    
    // Extract thumbnail
    const outputDir = path.join(process.env.VIDEO_OUTPUT_PATH || './public/videos', videoId);
    await videoService.extractThumbnail(filePath, outputDir);

    // Update video status
    video.status = 'ready';
    video.qualities = result.qualities;
    video.thumbnail = `${videoId}/thumbnail.jpg`;
    video.processingProgress = 100;
    await video.save();

    // Generate notes automatically
    console.log('🎬 Video processing complete, starting notes generation...');
    generateNotesAsync(videoId, video.title, video.description, io);

    // Emit completion event
    io.emit('videoProcessed', {
      videoId: videoId,
      status: 'ready',
      masterPlaylist: result.masterPlaylist
    });

    // Clean up original file
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Processing error:', error);
    video.status = 'failed';
    await video.save();
    
    io.emit('videoProcessingFailed', {
      videoId: videoId,
      error: error.message
    });
  }
}

// Generate notes automatically
async function generateNotesAsync(videoId, videoTitle, videoDescription, io) {
  try {
    console.log(`📝 Starting notes generation for video: ${videoId}`);
    const video = await Video.findOne({ videoId });
    if (!video) {
      console.error('❌ Video not found for notes generation:', videoId);
      return;
    }

    // Create notes record
    const notes = new Notes({
      videoId: video._id,
      generationStatus: 'generating',
      generatedBy: 'Llama 3',
      content: ''
    });
    await notes.save();
    console.log('✅ Notes record created:', notes._id);

    video.notes = notes._id;
    await video.save();

    // Generate notes using video title and description as context
    const context = `Video Title: ${videoTitle}\nDescription: ${videoDescription || 'N/A'}\n\nGenerate comprehensive educational notes for this educational video. Include a summary and key points.`;
    console.log('🤖 Calling Ollama to generate notes...');
    const result = await ollamaService.generateNotes(context);
    console.log('✅ Ollama response received');

    // Update notes with generated content
    notes.content = result.notes.content;
    notes.sections = result.notes.sections;
    notes.summary = result.notes.content.substring(0, 500); // First 500 chars as summary
    notes.keyPoints = result.notes.sections.map(s => s.title).slice(0, 5); // Extract key points from section titles
    notes.generationStatus = 'completed';
    notes.timestamp = new Date();
    await notes.save();
    console.log('✅ Notes saved successfully');

    io.emit('notesGenerated', {
      videoId: videoId,
      notesId: notes._id
    });
  } catch (error) {
    console.error('❌ Notes generation error:', error.message);
    console.error('Stack:', error.stack);
    
    // Try to update notes with error status
    try {
      const video = await Video.findOne({ videoId });
      if (video && video.notes) {
        await Notes.findByIdAndUpdate(video.notes, {
          generationStatus: 'failed',
          content: 'Failed to generate notes. Please try again later.'
        });
      }
    } catch (updateError) {
      console.error('Failed to update notes error status:', updateError);
    }
  }
}

// Get all videos
router.get('/', async (req, res) => {
  try {
    const videos = await Video.find()
      .populate('notes')
      .populate('subject')
      .sort({ createdAt: -1 })
      .select('-__v');
    
    res.json({ success: true, videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single video
router.get('/:videoId', async (req, res) => {
  try {
    const video = await Video.findOne({ videoId: req.params.videoId })
      .populate('notes')
      .populate('subject');
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Increment views
    video.views += 1;
    await video.save();

    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update video subject
router.patch('/:videoId/subject', async (req, res) => {
  try {
    const { subject } = req.body;
    
    const video = await Video.findById(req.params.videoId);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    video.subject = subject || null;
    await video.save();
    
    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual notes generation endpoint
router.post('/:videoId/generate-notes', async (req, res) => {
  try {
    const video = await Video.findOne({ videoId: req.params.videoId });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const io = req.app.get('io');
    
    // Start async notes generation
    generateNotesAsync(video.videoId, video.title, video.description, io);
    
    res.json({ 
      success: true, 
      message: 'Notes generation started. This may take a moment.' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete video
router.delete('/:videoId', async (req, res) => {
  try {
    const video = await Video.findOne({ videoId: req.params.videoId });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete video files
    const videoDir = path.join(process.env.VIDEO_OUTPUT_PATH || './public/videos', video.videoId);
    await fs.rm(videoDir, { recursive: true, force: true });

    // Delete notes
    if (video.notes) {
      await Notes.findByIdAndDelete(video.notes);
    }

    // Delete video record
    await Video.findByIdAndDelete(video._id);

    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
