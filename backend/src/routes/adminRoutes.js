const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Subject = require('../models/Subject');
const Video = require('../models/Video');

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  // In production, you'd verify JWT token here
  // For now, check if role is passed in header
  const userRole = req.headers['x-user-role'];
  
  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// ===== USER MANAGEMENT =====

// Get all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user role
router.patch('/users/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { role },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user
router.delete('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user statistics
router.get('/stats/users', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const students = await User.countDocuments({ role: 'student' });
    const teachers = await User.countDocuments({ role: 'teacher' });
    const admins = await User.countDocuments({ role: 'admin' });
    
    res.json({
      success: true,
      stats: {
        total: totalUsers,
        students,
        teachers,
        admins
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SUBJECT MANAGEMENT =====

// Get all subjects
router.get('/subjects', requireAdmin, async (req, res) => {
  try {
    const subjects = await Subject.find()
      .populate('teachers', 'name email')
      .sort({ name: 1 });
    
    res.json({ success: true, subjects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create subject
router.post('/subjects', requireAdmin, async (req, res) => {
  try {
    const { name, description, code, color, icon } = req.body;
    
    const subject = new Subject({
      name,
      description,
      code: code.toUpperCase(),
      color,
      icon
    });
    
    await subject.save();
    
    res.status(201).json({ success: true, subject });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Subject code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update subject
router.patch('/subjects/:subjectId', requireAdmin, async (req, res) => {
  try {
    const { name, description, color, icon, active } = req.body;
    
    const subject = await Subject.findByIdAndUpdate(
      req.params.subjectId,
      { name, description, color, icon, active },
      { new: true }
    ).populate('teachers', 'name email');
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json({ success: true, subject });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign teachers to subject
router.patch('/subjects/:subjectId/teachers', requireAdmin, async (req, res) => {
  try {
    const { teacherIds, teachers: teacherIdsAlt } = req.body;
    const ids = teacherIds || teacherIdsAlt || [];
    
    // Verify all users are teachers or admins
    const teachers = await User.find({
      _id: { $in: ids },
      role: { $in: ['teacher', 'admin'] }
    });
    
    if (teachers.length !== ids.length) {
      return res.status(400).json({ error: 'Some users are not teachers or admins' });
    }
    
    const subject = await Subject.findByIdAndUpdate(
      req.params.subjectId,
      { teachers: ids },
      { new: true }
    ).populate('teachers', 'name email');
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json({ success: true, subject });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete subject
router.delete('/subjects/:subjectId', requireAdmin, async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.subjectId);
    
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SYSTEM STATISTICS =====

router.get('/stats/overview', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalVideos = await Video.countDocuments();
    const totalSubjects = await Subject.countDocuments({ active: true });
    const processingVideos = await Video.countDocuments({ status: 'processing' });
    const readyVideos = await Video.countDocuments({ status: 'ready' });
    
    res.json({
      success: true,
      stats: {
        users: totalUsers,
        videos: totalVideos,
        subjects: totalSubjects,
        processingVideos,
        readyVideos
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
