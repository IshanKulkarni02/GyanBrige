const mongoose = require('mongoose');

const notesSchema = new mongoose.Schema({
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  sections: [{
    title: String,
    content: [String]
  }],
  summary: {
    type: String
  },
  keyPoints: [{
    type: String
  }],
  generatedBy: {
    type: String,
    default: 'llama3'
  },
  generationStatus: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'failed'],
    default: 'pending'
  },
  transcript: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
notesSchema.index({ videoId: 1 });
notesSchema.index({ generationStatus: 1 });

module.exports = mongoose.model('Notes', notesSchema);
