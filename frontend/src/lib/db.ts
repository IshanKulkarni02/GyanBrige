/**
 * Simple JSON file-based database for LMS
 * Can be easily upgraded to SQLite, PostgreSQL, or MongoDB later
 */

import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DB_PATH, 'users.json');
const COURSES_FILE = path.join(DB_PATH, 'courses.json');
const LECTURES_FILE = path.join(DB_PATH, 'lectures.json');
const ENROLLMENTS_FILE = path.join(DB_PATH, 'enrollments.json');
const ATTENDANCE_FILE = path.join(DB_PATH, 'attendance.json');

// Ensure data directory exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'admin';
  createdAt: string;
  avatar?: string;
}

export interface Course {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  teacherId: string;
  createdAt: string;
}

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl?: string;
  duration: number; // in minutes
  notes: string;
  order: number;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  progress: number; // percentage
  completedLectures: string[];
  enrolledAt: string;
}

export interface AttendanceRecord {
  id: string;
  courseId: string;
  date: string;
  records: { [studentId: string]: 'present' | 'absent' | 'late' };
  markedBy: string;
  createdAt: string;
}

// Helper functions
function readJSON<T>(filePath: string, defaultValue: T[] = []): T[] {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}

function writeJSON<T>(filePath: string, data: T[]): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Initialize with seed data if empty
function initializeDB() {
  const users = readJSON<User>(USERS_FILE);
  if (users.length === 0) {
    const seedUsers: User[] = [
      { id: 'u1', name: 'Arjun Kumar', email: 'student@gyan.com', password: 'student123', role: 'student', createdAt: new Date().toISOString() },
      { id: 'u2', name: 'Dr. Priya Sharma', email: 'teacher@gyan.com', password: 'teacher123', role: 'teacher', createdAt: new Date().toISOString() },
      { id: 'u3', name: 'Rahul Singh', email: 'admin@gyan.com', password: 'admin123', role: 'admin', createdAt: new Date().toISOString() },
      { id: 'u4', name: 'Meera Patel', email: 'meera@gyan.com', password: 'password123', role: 'student', createdAt: new Date().toISOString() },
      { id: 'u5', name: 'Vikram Joshi', email: 'vikram@gyan.com', password: 'password123', role: 'student', createdAt: new Date().toISOString() },
    ];
    writeJSON(USERS_FILE, seedUsers);
  }

  const courses = readJSON<Course>(COURSES_FILE);
  if (courses.length === 0) {
    const seedCourses: Course[] = [
      { id: 'c1', name: 'Mathematics', description: 'Algebra, Calculus, and Geometry', icon: '📐', color: 'from-emerald-500 to-teal-500', teacherId: 'u2', createdAt: new Date().toISOString() },
      { id: 'c2', name: 'Physics', description: 'Mechanics, Thermodynamics, and Optics', icon: '⚡', color: 'from-purple-500 to-indigo-500', teacherId: 'u2', createdAt: new Date().toISOString() },
      { id: 'c3', name: 'Chemistry', description: 'Organic, Inorganic, and Physical Chemistry', icon: '🧪', color: 'from-amber-500 to-orange-500', teacherId: 'u2', createdAt: new Date().toISOString() },
      { id: 'c4', name: 'Biology', description: 'Cell Biology, Genetics, and Ecology', icon: '🧬', color: 'from-green-500 to-emerald-500', teacherId: 'u2', createdAt: new Date().toISOString() },
      { id: 'c5', name: 'English', description: 'Grammar, Literature, and Writing', icon: '📚', color: 'from-blue-500 to-cyan-500', teacherId: 'u2', createdAt: new Date().toISOString() },
      { id: 'c6', name: 'History', description: 'World History and Indian History', icon: '🏛️', color: 'from-rose-500 to-pink-500', teacherId: 'u2', createdAt: new Date().toISOString() },
    ];
    writeJSON(COURSES_FILE, seedCourses);
  }

  const lectures = readJSON<Lecture>(LECTURES_FILE);
  if (lectures.length === 0) {
    const seedLectures: Lecture[] = [
      { id: 'l1', courseId: 'c1', title: 'Introduction to Algebra', description: 'Basic algebraic concepts', duration: 45, notes: '# Algebra Basics\n\n- Variables and constants\n- Linear equations\n- Quadratic equations', order: 1, createdAt: new Date().toISOString() },
      { id: 'l2', courseId: 'c1', title: 'Calculus Fundamentals', description: 'Limits and derivatives', duration: 50, notes: '# Calculus\n\n- Understanding limits\n- Derivatives\n- Integration basics', order: 2, createdAt: new Date().toISOString() },
      { id: 'l3', courseId: 'c1', title: 'Geometry Basics', description: 'Shapes and theorems', duration: 40, notes: '# Geometry\n\n- Types of angles\n- Triangles\n- Circles', order: 3, createdAt: new Date().toISOString() },
      { id: 'l4', courseId: 'c2', title: 'Laws of Motion', description: 'Newton\'s three laws', duration: 55, notes: '# Newton\'s Laws\n\n1. First Law (Inertia)\n2. Second Law (F=ma)\n3. Third Law (Action-Reaction)', order: 1, createdAt: new Date().toISOString() },
      { id: 'l5', courseId: 'c2', title: 'Thermodynamics', description: 'Heat and energy', duration: 48, notes: '# Thermodynamics\n\n- Heat transfer\n- Laws of thermodynamics\n- Entropy', order: 2, createdAt: new Date().toISOString() },
    ];
    writeJSON(LECTURES_FILE, seedLectures);
  }

  const enrollments = readJSON<Enrollment>(ENROLLMENTS_FILE);
  if (enrollments.length === 0) {
    const seedEnrollments: Enrollment[] = [
      { id: 'e1', userId: 'u1', courseId: 'c1', progress: 66, completedLectures: ['l1', 'l2'], enrolledAt: new Date().toISOString() },
      { id: 'e2', userId: 'u1', courseId: 'c2', progress: 50, completedLectures: ['l4'], enrolledAt: new Date().toISOString() },
      { id: 'e3', userId: 'u4', courseId: 'c1', progress: 33, completedLectures: ['l1'], enrolledAt: new Date().toISOString() },
      { id: 'e4', userId: 'u5', courseId: 'c1', progress: 100, completedLectures: ['l1', 'l2', 'l3'], enrolledAt: new Date().toISOString() },
    ];
    writeJSON(ENROLLMENTS_FILE, seedEnrollments);
  }
}

// Initialize on import
initializeDB();

// User operations
export const users = {
  getAll: (): User[] => readJSON<User>(USERS_FILE),
  
  getById: (id: string): User | undefined => {
    const all = readJSON<User>(USERS_FILE);
    return all.find(u => u.id === id);
  },
  
  getByEmail: (email: string): User | undefined => {
    const all = readJSON<User>(USERS_FILE);
    return all.find(u => u.email.toLowerCase() === email.toLowerCase());
  },
  
  create: (user: Omit<User, 'id' | 'createdAt'>): User => {
    const all = readJSON<User>(USERS_FILE);
    const newUser: User = {
      ...user,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    all.push(newUser);
    writeJSON(USERS_FILE, all);
    return newUser;
  },
  
  update: (id: string, updates: Partial<User>): User | null => {
    const all = readJSON<User>(USERS_FILE);
    const index = all.findIndex(u => u.id === id);
    if (index === -1) return null;
    all[index] = { ...all[index], ...updates };
    writeJSON(USERS_FILE, all);
    return all[index];
  },
  
  delete: (id: string): boolean => {
    const all = readJSON<User>(USERS_FILE);
    const filtered = all.filter(u => u.id !== id);
    if (filtered.length === all.length) return false;
    writeJSON(USERS_FILE, filtered);
    return true;
  },
  
  getByRole: (role: User['role']): User[] => {
    const all = readJSON<User>(USERS_FILE);
    return all.filter(u => u.role === role);
  },
};

// Course operations
export const courses = {
  getAll: (): Course[] => readJSON<Course>(COURSES_FILE),
  
  getById: (id: string): Course | undefined => {
    const all = readJSON<Course>(COURSES_FILE);
    return all.find(c => c.id === id);
  },
  
  getByTeacher: (teacherId: string): Course[] => {
    const all = readJSON<Course>(COURSES_FILE);
    return all.filter(c => c.teacherId === teacherId);
  },
  
  create: (course: Omit<Course, 'id' | 'createdAt'>): Course => {
    const all = readJSON<Course>(COURSES_FILE);
    const newCourse: Course = {
      ...course,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    all.push(newCourse);
    writeJSON(COURSES_FILE, all);
    return newCourse;
  },
  
  update: (id: string, updates: Partial<Course>): Course | null => {
    const all = readJSON<Course>(COURSES_FILE);
    const index = all.findIndex(c => c.id === id);
    if (index === -1) return null;
    all[index] = { ...all[index], ...updates };
    writeJSON(COURSES_FILE, all);
    return all[index];
  },
  
  delete: (id: string): boolean => {
    const all = readJSON<Course>(COURSES_FILE);
    const filtered = all.filter(c => c.id !== id);
    if (filtered.length === all.length) return false;
    writeJSON(COURSES_FILE, filtered);
    return true;
  },
};

// Lecture operations
export const lectures = {
  getAll: (): Lecture[] => readJSON<Lecture>(LECTURES_FILE),
  
  getById: (id: string): Lecture | undefined => {
    const all = readJSON<Lecture>(LECTURES_FILE);
    return all.find(l => l.id === id);
  },
  
  getByCourse: (courseId: string): Lecture[] => {
    const all = readJSON<Lecture>(LECTURES_FILE);
    return all.filter(l => l.courseId === courseId).sort((a, b) => a.order - b.order);
  },
  
  create: (lecture: Omit<Lecture, 'id' | 'createdAt'>): Lecture => {
    const all = readJSON<Lecture>(LECTURES_FILE);
    const newLecture: Lecture = {
      ...lecture,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    all.push(newLecture);
    writeJSON(LECTURES_FILE, all);
    return newLecture;
  },
  
  update: (id: string, updates: Partial<Lecture>): Lecture | null => {
    const all = readJSON<Lecture>(LECTURES_FILE);
    const index = all.findIndex(l => l.id === id);
    if (index === -1) return null;
    all[index] = { ...all[index], ...updates };
    writeJSON(LECTURES_FILE, all);
    return all[index];
  },
  
  delete: (id: string): boolean => {
    const all = readJSON<Lecture>(LECTURES_FILE);
    const filtered = all.filter(l => l.id !== id);
    if (filtered.length === all.length) return false;
    writeJSON(LECTURES_FILE, filtered);
    return true;
  },
};

// Enrollment operations
export const enrollments = {
  getAll: (): Enrollment[] => readJSON<Enrollment>(ENROLLMENTS_FILE),
  
  getByUser: (userId: string): Enrollment[] => {
    const all = readJSON<Enrollment>(ENROLLMENTS_FILE);
    return all.filter(e => e.userId === userId);
  },
  
  getByCourse: (courseId: string): Enrollment[] => {
    const all = readJSON<Enrollment>(ENROLLMENTS_FILE);
    return all.filter(e => e.courseId === courseId);
  },
  
  get: (userId: string, courseId: string): Enrollment | undefined => {
    const all = readJSON<Enrollment>(ENROLLMENTS_FILE);
    return all.find(e => e.userId === userId && e.courseId === courseId);
  },
  
  enroll: (userId: string, courseId: string): Enrollment => {
    const all = readJSON<Enrollment>(ENROLLMENTS_FILE);
    const existing = all.find(e => e.userId === userId && e.courseId === courseId);
    if (existing) return existing;
    
    const newEnrollment: Enrollment = {
      id: generateId(),
      userId,
      courseId,
      progress: 0,
      completedLectures: [],
      enrolledAt: new Date().toISOString(),
    };
    all.push(newEnrollment);
    writeJSON(ENROLLMENTS_FILE, all);
    return newEnrollment;
  },
  
  updateProgress: (userId: string, courseId: string, lectureId: string): Enrollment | null => {
    const all = readJSON<Enrollment>(ENROLLMENTS_FILE);
    const index = all.findIndex(e => e.userId === userId && e.courseId === courseId);
    if (index === -1) return null;
    
    if (!all[index].completedLectures.includes(lectureId)) {
      all[index].completedLectures.push(lectureId);
    }
    
    // Calculate progress
    const courseLectures = lectures.getByCourse(courseId);
    all[index].progress = Math.round((all[index].completedLectures.length / courseLectures.length) * 100);
    
    writeJSON(ENROLLMENTS_FILE, all);
    return all[index];
  },
  
  unenroll: (userId: string, courseId: string): boolean => {
    const all = readJSON<Enrollment>(ENROLLMENTS_FILE);
    const filtered = all.filter(e => !(e.userId === userId && e.courseId === courseId));
    if (filtered.length === all.length) return false;
    writeJSON(ENROLLMENTS_FILE, filtered);
    return true;
  },
};

// Attendance operations
export const attendance = {
  getAll: (): AttendanceRecord[] => readJSON<AttendanceRecord>(ATTENDANCE_FILE),
  
  getByCourse: (courseId: string): AttendanceRecord[] => {
    const all = readJSON<AttendanceRecord>(ATTENDANCE_FILE);
    return all.filter(a => a.courseId === courseId).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  },
  
  getByDate: (courseId: string, date: string): AttendanceRecord | undefined => {
    const all = readJSON<AttendanceRecord>(ATTENDANCE_FILE);
    return all.find(a => a.courseId === courseId && a.date === date);
  },
  
  mark: (courseId: string, date: string, records: { [studentId: string]: 'present' | 'absent' | 'late' }, markedBy: string): AttendanceRecord => {
    const all = readJSON<AttendanceRecord>(ATTENDANCE_FILE);
    const existingIndex = all.findIndex(a => a.courseId === courseId && a.date === date);
    
    if (existingIndex !== -1) {
      all[existingIndex].records = records;
      all[existingIndex].markedBy = markedBy;
      writeJSON(ATTENDANCE_FILE, all);
      return all[existingIndex];
    }
    
    const newRecord: AttendanceRecord = {
      id: generateId(),
      courseId,
      date,
      records,
      markedBy,
      createdAt: new Date().toISOString(),
    };
    all.push(newRecord);
    writeJSON(ATTENDANCE_FILE, all);
    return newRecord;
  },
  
  getStudentAttendance: (courseId: string, studentId: string): { total: number; present: number; percentage: number } => {
    const records = readJSON<AttendanceRecord>(ATTENDANCE_FILE).filter(a => a.courseId === courseId);
    let present = 0;
    let total = 0;
    
    records.forEach(r => {
      if (r.records[studentId]) {
        total++;
        if (r.records[studentId] === 'present' || r.records[studentId] === 'late') {
          present++;
        }
      }
    });
    
    return {
      total,
      present,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  },
};

export default { users, courses, lectures, enrollments, attendance };
