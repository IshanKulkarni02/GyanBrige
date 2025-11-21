const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  color: {
    type: String,
    default: '#2196F3' // Material blue
  },
  icon: {
    type: String,
    default: 'book'
  },
  teachers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
subjectSchema.index({ code: 1 });
subjectSchema.index({ active: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
