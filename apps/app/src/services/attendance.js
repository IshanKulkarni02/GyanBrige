/**
 * Attendance Service
 * Local SQLite database for storing attendance data
 */

import * as SQLite from 'expo-sqlite';

// Database name
const DB_NAME = 'gyanbrige.db';

// Database instance
let db = null;

/**
 * Initialize the database
 */
export const initializeDatabase = async () => {
  try {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    
    // Create tables
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      
      -- Students table
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        roll_number TEXT,
        email TEXT,
        class_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Classes table
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        teacher_id TEXT,
        subject TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Attendance records table
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late')),
        marked_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, class_id, date),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (class_id) REFERENCES classes(id)
      );
    `);
    
    // Seed demo data if empty
    const studentCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM students');
    if (studentCount.count === 0) {
      await seedDemoData();
    }
    
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

/**
 * Seed demo data for testing
 */
const seedDemoData = async () => {
  // Demo class
  const classId = 'class_10a';
  await db.runAsync(
    'INSERT INTO classes (id, name, teacher_id, subject) VALUES (?, ?, ?, ?)',
    [classId, 'Class 10-A', 'teacher_1', 'Mathematics']
  );
  
  // Demo students
  const students = [
    { id: 'student_1', name: 'Aarav Sharma', roll: '001', email: 'aarav@school.com' },
    { id: 'student_2', name: 'Priya Patel', roll: '002', email: 'priya@school.com' },
    { id: 'student_3', name: 'Rohan Gupta', roll: '003', email: 'rohan@school.com' },
    { id: 'student_4', name: 'Ananya Singh', roll: '004', email: 'ananya@school.com' },
    { id: 'student_5', name: 'Vikram Joshi', roll: '005', email: 'vikram@school.com' },
    { id: 'student_6', name: 'Meera Reddy', roll: '006', email: 'meera@school.com' },
    { id: 'student_7', name: 'Arjun Kumar', roll: '007', email: 'arjun@school.com' },
    { id: 'student_8', name: 'Sneha Verma', roll: '008', email: 'sneha@school.com' },
    { id: 'student_9', name: 'Rahul Deshmukh', roll: '009', email: 'rahul@school.com' },
    { id: 'student_10', name: 'Kavya Nair', roll: '010', email: 'kavya@school.com' },
    { id: 'student_11', name: 'Aditya Iyer', roll: '011', email: 'aditya@school.com' },
    { id: 'student_12', name: 'Ishita Mehta', roll: '012', email: 'ishita@school.com' },
  ];
  
  for (const student of students) {
    await db.runAsync(
      'INSERT INTO students (id, name, roll_number, email, class_id) VALUES (?, ?, ?, ?, ?)',
      [student.id, student.name, student.roll, student.email, classId]
    );
  }
  
  console.log('Demo data seeded successfully');
};

/**
 * Get all classes for a teacher
 */
export const getTeacherClasses = async (teacherId) => {
  try {
    const classes = await db.getAllAsync(
      'SELECT * FROM classes WHERE teacher_id = ? ORDER BY name',
      [teacherId]
    );
    return classes;
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    throw error;
  }
};

/**
 * Get students for a class
 */
export const getClassStudents = async (classId) => {
  try {
    const students = await db.getAllAsync(
      'SELECT * FROM students WHERE class_id = ? ORDER BY roll_number, name',
      [classId]
    );
    return students;
  } catch (error) {
    console.error('Error fetching class students:', error);
    throw error;
  }
};

/**
 * Get attendance for a specific date
 */
export const getAttendanceForDate = async (classId, date) => {
  try {
    // Format date as YYYY-MM-DD
    const dateStr = formatDate(date);
    
    const records = await db.getAllAsync(
      `SELECT a.*, s.name as student_name, s.roll_number 
       FROM attendance a 
       JOIN students s ON a.student_id = s.id 
       WHERE a.class_id = ? AND a.date = ?`,
      [classId, dateStr]
    );
    
    // Convert to a map for easy lookup
    const attendanceMap = {};
    records.forEach(record => {
      attendanceMap[record.student_id] = record.status;
    });
    
    return attendanceMap;
  } catch (error) {
    console.error('Error fetching attendance:', error);
    throw error;
  }
};

/**
 * Mark attendance for a student
 */
export const markAttendance = async (studentId, classId, date, status, markedBy = null) => {
  try {
    const dateStr = formatDate(date);
    
    // Upsert attendance record
    await db.runAsync(
      `INSERT INTO attendance (student_id, class_id, date, status, marked_by, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(student_id, class_id, date) 
       DO UPDATE SET status = ?, marked_by = ?, updated_at = CURRENT_TIMESTAMP`,
      [studentId, classId, dateStr, status, markedBy, status, markedBy]
    );
    
    return true;
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
};

/**
 * Mark attendance for multiple students at once
 */
export const markBulkAttendance = async (classId, date, attendanceData, markedBy = null) => {
  try {
    const dateStr = formatDate(date);
    
    // Use a transaction for bulk operations
    await db.withTransactionAsync(async () => {
      for (const [studentId, status] of Object.entries(attendanceData)) {
        await db.runAsync(
          `INSERT INTO attendance (student_id, class_id, date, status, marked_by, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(student_id, class_id, date) 
           DO UPDATE SET status = ?, marked_by = ?, updated_at = CURRENT_TIMESTAMP`,
          [studentId, classId, dateStr, status, markedBy, status, markedBy]
        );
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error marking bulk attendance:', error);
    throw error;
  }
};

/**
 * Get attendance statistics for a class
 */
export const getClassAttendanceStats = async (classId, startDate, endDate) => {
  try {
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
    
    const stats = await db.getFirstAsync(
      `SELECT 
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN status = 'late' THEN 1 END) as late_count,
        COUNT(*) as total_records
       FROM attendance 
       WHERE class_id = ? AND date >= ? AND date <= ?`,
      [classId, startStr, endStr]
    );
    
    return stats;
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    throw error;
  }
};

/**
 * Get student attendance history
 */
export const getStudentAttendanceHistory = async (studentId, classId, limit = 30) => {
  try {
    const records = await db.getAllAsync(
      `SELECT * FROM attendance 
       WHERE student_id = ? AND class_id = ? 
       ORDER BY date DESC 
       LIMIT ?`,
      [studentId, classId, limit]
    );
    
    return records;
  } catch (error) {
    console.error('Error fetching student attendance history:', error);
    throw error;
  }
};

/**
 * Get attendance percentage for a student
 */
export const getStudentAttendancePercentage = async (studentId, classId) => {
  try {
    const stats = await db.getFirstAsync(
      `SELECT 
        COUNT(CASE WHEN status = 'present' OR status = 'late' THEN 1 END) as attended,
        COUNT(*) as total
       FROM attendance 
       WHERE student_id = ? AND class_id = ?`,
      [studentId, classId]
    );
    
    if (stats.total === 0) return 0;
    return Math.round((stats.attended / stats.total) * 100);
  } catch (error) {
    console.error('Error calculating attendance percentage:', error);
    throw error;
  }
};

/**
 * Get recent attendance dates for a class
 */
export const getRecentAttendanceDates = async (classId, limit = 7) => {
  try {
    const dates = await db.getAllAsync(
      `SELECT DISTINCT date, 
        COUNT(CASE WHEN status = 'present' THEN 1 END) as present,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) as absent
       FROM attendance 
       WHERE class_id = ? 
       GROUP BY date
       ORDER BY date DESC 
       LIMIT ?`,
      [classId, limit]
    );
    
    return dates;
  } catch (error) {
    console.error('Error fetching recent dates:', error);
    throw error;
  }
};

/**
 * Delete attendance record
 */
export const deleteAttendance = async (studentId, classId, date) => {
  try {
    const dateStr = formatDate(date);
    await db.runAsync(
      'DELETE FROM attendance WHERE student_id = ? AND class_id = ? AND date = ?',
      [studentId, classId, dateStr]
    );
    return true;
  } catch (error) {
    console.error('Error deleting attendance:', error);
    throw error;
  }
};

/**
 * Helper: Format date to YYYY-MM-DD string
 */
const formatDate = (date) => {
  if (typeof date === 'string') {
    // If already a string, validate and return
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    // Try to parse and reformat
    date = new Date(date);
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Helper: Parse date string to Date object
 */
export const parseDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Export attendance to JSON (for backup)
 */
export const exportAttendanceData = async (classId) => {
  try {
    const students = await getClassStudents(classId);
    const attendance = await db.getAllAsync(
      'SELECT * FROM attendance WHERE class_id = ? ORDER BY date DESC',
      [classId]
    );
    
    return {
      exportedAt: new Date().toISOString(),
      classId,
      students,
      attendance,
    };
  } catch (error) {
    console.error('Error exporting attendance:', error);
    throw error;
  }
};

export default {
  initializeDatabase,
  getTeacherClasses,
  getClassStudents,
  getAttendanceForDate,
  markAttendance,
  markBulkAttendance,
  getClassAttendanceStats,
  getStudentAttendanceHistory,
  getStudentAttendancePercentage,
  getRecentAttendanceDates,
  deleteAttendance,
  exportAttendanceData,
  parseDate,
};
