const express = require('express');
const router = express.Router();
const Notes = require('../models/Notes');
const ollamaService = require('../services/ollamaService');

// Get notes for a video
router.get('/video/:videoId', async (req, res) => {
  try {
    const notes = await Notes.findOne({ videoId: req.params.videoId });
    
    if (!notes) {
      return res.status(404).json({ error: 'Notes not found' });
    }

    res.json({ success: true, notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Regenerate notes for a video
router.post('/regenerate/:videoId', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await ollamaService.generateNotes(content);
    
    const notes = await Notes.findOneAndUpdate(
      { videoId: req.params.videoId },
      {
        content: result.notes.content,
        sections: result.notes.sections,
        generationStatus: 'completed'
      },
      { new: true }
    );

    res.json({ success: true, notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
