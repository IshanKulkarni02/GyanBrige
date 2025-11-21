const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  videoId: {
    type: String,
    required: true,
    unique: true
  },
  masterPlaylist: {
    type: String,
    required: true
  },
  qualities: [{
    type: String
  }],
  thumbnail: {
    type: String
  },
  duration: {
    type: Number // in seconds
  },
  fileSize: {
    type: Number // in bytes
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  },
  lesson: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['processing', 'ready', 'failed'],
    default: 'processing'
  },
  processingProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  metadata: {
    format: String,
    codec: String,
    resolution: String,
    fps: Number
  },
  views: {
    type: Number,
    default: 0
  },
  notes: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notes'
  }
}, {
  timestamps: true
});

// Index for faster queries
videoSchema.index({ videoId: 1 });
videoSchema.index({ uploadedBy: 1 });
videoSchema.index({ status: 1 });
videoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Video', videoSchema);
