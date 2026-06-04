/**
 * SQLite database layer for GyanBrige LMS.
 * Uses better-sqlite3 (synchronous, ACID, file-based — no server needed).
 * Exports the same interface as the previous JSON-file implementation
 * so all callers work without changes.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'admin';
  createdAt: string;
  avatar?: string;
  macAddress?: string;
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

export interface Segment { start: number; end: number; text: string; }
export interface Chapter { startSec: number; title: string; }

export interface Lecture {
  id: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl?: string;
  duration: number;
  notes: string;
  segments: Segment[];
  chapters: Chapter[];
  order: number;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  progress: number;
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

export interface Invite {
  token: string;
  role: 'student' | 'teacher' | 'admin';
  createdBy: string;
  createdAt: string;
  expiresAt: string;
}

// ─── Database setup ───────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'gyanbrige.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
    createdAt  TEXT NOT NULL,
    avatar     TEXT,
    macAddress TEXT
  );

  CREATE TABLE IF NOT EXISTS courses (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '📚',
    color       TEXT NOT NULL DEFAULT 'from-emerald-500 to-teal-500',
    teacherId   TEXT NOT NULL REFERENCES users(id),
    createdAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lectures (
    id          TEXT PRIMARY KEY,
    courseId    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    videoUrl    TEXT,
    duration    INTEGER NOT NULL DEFAULT 30,
    notes       TEXT NOT NULL DEFAULT '',
    segments    TEXT NOT NULL DEFAULT '[]',
    chapters    TEXT NOT NULL DEFAULT '[]',
    "order"     INTEGER NOT NULL DEFAULT 1,
    createdAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id                 TEXT PRIMARY KEY,
    userId             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courseId           TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    progress           INTEGER NOT NULL DEFAULT 0,
    completedLectures  TEXT NOT NULL DEFAULT '[]',
    enrolledAt         TEXT NOT NULL,
    UNIQUE(userId, courseId)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id        TEXT PRIMARY KEY,
    courseId  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    date      TEXT NOT NULL,
    records   TEXT NOT NULL DEFAULT '{}',
    markedBy  TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    UNIQUE(courseId, date)
  );

  CREATE TABLE IF NOT EXISTS invites (
    token     TEXT PRIMARY KEY,
    role      TEXT NOT NULL,
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Seed default data if tables are empty
(function seed() {
  const count = (db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n;
  if (count > 0) return;

  const now = new Date().toISOString();
  const insertUser = db.prepare(
    'INSERT INTO users (id,name,email,password,role,createdAt) VALUES (?,?,?,?,?,?)'
  );
  // Passwords are plain here — the auth routes will bcrypt them on real signups.
  // For seed accounts bcrypt is applied at first real login via the signup route.
  // These are development-only demo accounts.
  insertUser.run('u1', 'Arjun Kumar',    'student@gyan.com', 'student123', 'student', now);
  insertUser.run('u2', 'Dr. Priya Sharma','teacher@gyan.com', 'teacher123', 'teacher', now);
  insertUser.run('u3', 'Rahul Singh',    'admin@gyan.com',   'admin123',  'admin',   now);
  insertUser.run('u4', 'Meera Patel',    'meera@gyan.com',   'password123','student', now);
  insertUser.run('u5', 'Vikram Joshi',   'vikram@gyan.com',  'password123','student', now);

  const insertCourse = db.prepare(
    'INSERT INTO courses (id,name,description,icon,color,teacherId,createdAt) VALUES (?,?,?,?,?,?,?)'
  );
  insertCourse.run('c1','Mathematics','Algebra, Calculus, and Geometry','📐','from-emerald-500 to-teal-500','u2',now);
  insertCourse.run('c2','Physics','Mechanics, Thermodynamics, and Optics','⚡','from-purple-500 to-indigo-500','u2',now);
  insertCourse.run('c3','Chemistry','Organic, Inorganic, and Physical Chemistry','🧪','from-amber-500 to-orange-500','u2',now);
  insertCourse.run('c4','Biology','Cell Biology, Genetics, and Ecology','🧬','from-green-500 to-emerald-500','u2',now);
  insertCourse.run('c5','English','Grammar, Literature, and Writing','📚','from-blue-500 to-cyan-500','u2',now);
  insertCourse.run('c6','History','World History and Indian History','🏛️','from-rose-500 to-pink-500','u2',now);

  const insertLecture = db.prepare(
    'INSERT INTO lectures (id,courseId,title,description,duration,notes,"order",createdAt) VALUES (?,?,?,?,?,?,?,?)'
  );
  insertLecture.run('l1','c1','Introduction to Algebra','Basic algebraic concepts',45,'# Algebra Basics\n\n- Variables and constants\n- Linear equations',1,now);
  insertLecture.run('l2','c1','Calculus Fundamentals','Limits and derivatives',50,'# Calculus\n\n- Limits\n- Derivatives\n- Integration basics',2,now);
  insertLecture.run('l3','c1','Geometry Basics','Shapes and theorems',40,'# Geometry\n\n- Angles\n- Triangles\n- Circles',3,now);
  insertLecture.run('l4','c2','Laws of Motion','Newton\'s three laws',55,'# Newton\'s Laws\n\n1. Inertia\n2. F=ma\n3. Action-Reaction',1,now);
  insertLecture.run('l5','c2','Thermodynamics','Heat and energy',48,'# Thermodynamics\n\n- Heat transfer\n- Laws\n- Entropy',2,now);

  const insertEnrollment = db.prepare(
    'INSERT INTO enrollments (id,userId,courseId,progress,completedLectures,enrolledAt) VALUES (?,?,?,?,?,?)'
  );
  insertEnrollment.run('e1','u1','c1',66,JSON.stringify(['l1','l2']),now);
  insertEnrollment.run('e2','u1','c2',50,JSON.stringify(['l4']),now);
  insertEnrollment.run('e3','u4','c1',33,JSON.stringify(['l1']),now);
  insertEnrollment.run('e4','u5','c1',100,JSON.stringify(['l1','l2','l3']),now);
})();

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = {
  getAll(): User[] {
    return db.prepare('SELECT * FROM users ORDER BY createdAt DESC').all() as User[];
  },
  getById(id: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  },
  getByEmail(email: string): User | undefined {
    return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email) as User | undefined;
  },
  getByRole(role: User['role']): User[] {
    return db.prepare('SELECT * FROM users WHERE role = ?').all(role) as User[];
  },
  create(data: Omit<User, 'id' | 'createdAt'>): User {
    const id = generateId();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO users (id,name,email,password,role,createdAt,avatar,macAddress) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, data.name, data.email, data.password, data.role, createdAt, data.avatar ?? null, data.macAddress ?? null);
    return { ...data, id, createdAt };
  },
  update(id: string, updates: Partial<User>): User | null {
    const existing = users.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    db.prepare(
      'UPDATE users SET name=?,email=?,password=?,role=?,avatar=?,macAddress=? WHERE id=?'
    ).run(merged.name, merged.email, merged.password, merged.role, merged.avatar ?? null, merged.macAddress ?? null, id);
    return merged;
  },
  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

// ─── Courses ──────────────────────────────────────────────────────────────────

export const courses = {
  getAll(): Course[] {
    return db.prepare('SELECT * FROM courses ORDER BY createdAt DESC').all() as Course[];
  },
  getById(id: string): Course | undefined {
    return db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as Course | undefined;
  },
  getByTeacher(teacherId: string): Course[] {
    return db.prepare('SELECT * FROM courses WHERE teacherId = ?').all(teacherId) as Course[];
  },
  create(data: Omit<Course, 'id' | 'createdAt'>): Course {
    const id = generateId();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO courses (id,name,description,icon,color,teacherId,createdAt) VALUES (?,?,?,?,?,?,?)'
    ).run(id, data.name, data.description, data.icon, data.color, data.teacherId, createdAt);
    return { ...data, id, createdAt };
  },
  update(id: string, updates: Partial<Course>): Course | null {
    const existing = courses.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    db.prepare(
      'UPDATE courses SET name=?,description=?,icon=?,color=?,teacherId=? WHERE id=?'
    ).run(merged.name, merged.description, merged.icon, merged.color, merged.teacherId, id);
    return merged;
  },
  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM courses WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

// ─── Lectures ─────────────────────────────────────────────────────────────────

// Migrate existing DB — add columns if they don't exist yet
try {
  db.exec('ALTER TABLE lectures ADD COLUMN segments TEXT NOT NULL DEFAULT \'[]\'');
} catch { /* column already exists */ }
try {
  db.exec('ALTER TABLE lectures ADD COLUMN chapters TEXT NOT NULL DEFAULT \'[]\'');
} catch { /* column already exists */ }

function parseLecture(row: Record<string, unknown>): Lecture {
  return {
    ...(row as Omit<Lecture, 'segments' | 'chapters'>),
    segments: JSON.parse((row.segments as string) || '[]'),
    chapters: JSON.parse((row.chapters as string) || '[]'),
  };
}

export const lectures = {
  getAll(): Lecture[] {
    return (db.prepare('SELECT * FROM lectures ORDER BY "order" ASC').all() as Record<string, unknown>[]).map(parseLecture);
  },
  getById(id: string): Lecture | undefined {
    const row = db.prepare('SELECT * FROM lectures WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? parseLecture(row) : undefined;
  },
  getByCourse(courseId: string): Lecture[] {
    return (db.prepare('SELECT * FROM lectures WHERE courseId = ? ORDER BY "order" ASC').all(courseId) as Record<string, unknown>[]).map(parseLecture);
  },
  create(data: Omit<Lecture, 'id' | 'createdAt'>): Lecture {
    const id = generateId();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO lectures (id,courseId,title,description,videoUrl,duration,notes,segments,chapters,"order",createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(id, data.courseId, data.title, data.description, data.videoUrl ?? null, data.duration, data.notes,
      JSON.stringify(data.segments ?? []), JSON.stringify(data.chapters ?? []), data.order, createdAt);
    return { ...data, segments: data.segments ?? [], chapters: data.chapters ?? [], id, createdAt };
  },
  update(id: string, updates: Partial<Lecture>): Lecture | null {
    const existing = lectures.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    db.prepare(
      'UPDATE lectures SET title=?,description=?,videoUrl=?,duration=?,notes=?,segments=?,chapters=?,"order"=? WHERE id=?'
    ).run(merged.title, merged.description, merged.videoUrl ?? null, merged.duration, merged.notes,
      JSON.stringify(merged.segments), JSON.stringify(merged.chapters), merged.order, id);
    return merged;
  },
  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM lectures WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

// ─── Enrollments ──────────────────────────────────────────────────────────────

function parseEnrollment(row: Record<string, unknown>): Enrollment {
  return {
    ...(row as Enrollment),
    completedLectures: JSON.parse((row.completedLectures as string) || '[]'),
  };
}

export const enrollments = {
  getAll(): Enrollment[] {
    return (db.prepare('SELECT * FROM enrollments').all() as Record<string, unknown>[]).map(parseEnrollment);
  },
  getByUser(userId: string): Enrollment[] {
    return (db.prepare('SELECT * FROM enrollments WHERE userId = ?').all(userId) as Record<string, unknown>[]).map(parseEnrollment);
  },
  getByCourse(courseId: string): Enrollment[] {
    return (db.prepare('SELECT * FROM enrollments WHERE courseId = ?').all(courseId) as Record<string, unknown>[]).map(parseEnrollment);
  },
  get(userId: string, courseId: string): Enrollment | undefined {
    const row = db.prepare('SELECT * FROM enrollments WHERE userId = ? AND courseId = ?').get(userId, courseId) as Record<string, unknown> | undefined;
    return row ? parseEnrollment(row) : undefined;
  },
  enroll(userId: string, courseId: string): Enrollment {
    const existing = enrollments.get(userId, courseId);
    if (existing) return existing;
    const id = generateId();
    const enrolledAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO enrollments (id,userId,courseId,progress,completedLectures,enrolledAt) VALUES (?,?,?,0,\'[]\',?)'
    ).run(id, userId, courseId, enrolledAt);
    return { id, userId, courseId, progress: 0, completedLectures: [], enrolledAt };
  },
  updateProgress(userId: string, courseId: string, lectureId: string): Enrollment | null {
    const existing = enrollments.get(userId, courseId);
    if (!existing) return null;
    if (!existing.completedLectures.includes(lectureId)) {
      existing.completedLectures.push(lectureId);
    }
    const total = lectures.getByCourse(courseId).length;
    const progress = total > 0 ? Math.round((existing.completedLectures.length / total) * 100) : 0;
    db.prepare(
      'UPDATE enrollments SET completedLectures=?,progress=? WHERE userId=? AND courseId=?'
    ).run(JSON.stringify(existing.completedLectures), progress, userId, courseId);
    return { ...existing, progress };
  },
  unenroll(userId: string, courseId: string): boolean {
    const result = db.prepare('DELETE FROM enrollments WHERE userId=? AND courseId=?').run(userId, courseId);
    return result.changes > 0;
  },
};

// ─── Attendance ───────────────────────────────────────────────────────────────

function parseAttendance(row: Record<string, unknown>): AttendanceRecord {
  return {
    ...(row as AttendanceRecord),
    records: JSON.parse((row.records as string) || '{}'),
  };
}

export const attendance = {
  getAll(): AttendanceRecord[] {
    return (db.prepare('SELECT * FROM attendance').all() as Record<string, unknown>[]).map(parseAttendance);
  },
  getByCourse(courseId: string): AttendanceRecord[] {
    return (db.prepare('SELECT * FROM attendance WHERE courseId = ? ORDER BY date DESC').all(courseId) as Record<string, unknown>[]).map(parseAttendance);
  },
  getByDate(courseId: string, date: string): AttendanceRecord | undefined {
    const row = db.prepare('SELECT * FROM attendance WHERE courseId=? AND date=?').get(courseId, date) as Record<string, unknown> | undefined;
    return row ? parseAttendance(row) : undefined;
  },
  mark(courseId: string, date: string, records: AttendanceRecord['records'], markedBy: string): AttendanceRecord {
    const existing = attendance.getByDate(courseId, date);
    const recordsJson = JSON.stringify(records);
    if (existing) {
      db.prepare('UPDATE attendance SET records=?,markedBy=? WHERE courseId=? AND date=?')
        .run(recordsJson, markedBy, courseId, date);
      return { ...existing, records, markedBy };
    }
    const id = generateId();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO attendance (id,courseId,date,records,markedBy,createdAt) VALUES (?,?,?,?,?,?)'
    ).run(id, courseId, date, recordsJson, markedBy, createdAt);
    return { id, courseId, date, records, markedBy, createdAt };
  },
  getStudentAttendance(courseId: string, studentId: string): { total: number; present: number; percentage: number } {
    const rows = attendance.getByCourse(courseId);
    let present = 0, total = 0;
    for (const r of rows) {
      if (r.records[studentId]) {
        total++;
        if (r.records[studentId] === 'present' || r.records[studentId] === 'late') present++;
      }
    }
    return { total, present, percentage: total > 0 ? Math.round((present / total) * 100) : 0 };
  },
};

// ─── Invites ──────────────────────────────────────────────────────────────────

export const invites = {
  getAll(): Invite[] {
    return db.prepare('SELECT * FROM invites ORDER BY createdAt DESC').all() as Invite[];
  },
  getByToken(token: string): Invite | undefined {
    return db.prepare('SELECT * FROM invites WHERE token = ?').get(token) as Invite | undefined;
  },
  create(role: Invite['role'], createdBy: string): Invite {
    const token = generateId() + generateId();
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO invites (token,role,createdBy,createdAt,expiresAt) VALUES (?,?,?,?,?)'
    ).run(token, role, createdBy, createdAt, expiresAt);
    return { token, role, createdBy, createdAt, expiresAt };
  },
  consume(token: string): Invite | null {
    const invite = invites.getByToken(token);
    if (!invite) return null;
    db.prepare('DELETE FROM invites WHERE token = ?').run(token);
    return invite;
  },
  delete(token: string): boolean {
    const result = db.prepare('DELETE FROM invites WHERE token = ?').run(token);
    return result.changes > 0;
  },
  isValid(token: string): Invite | null {
    const invite = invites.getByToken(token);
    if (!invite) return null;
    if (new Date(invite.expiresAt) < new Date()) return null;
    return invite;
  },
};

// ─── Settings (server-side key-value store) ───────────────────────────────────

export const settings = {
  get(key: string): string | null {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  },
  set(key: string, value: string): void {
    db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
  },
  getAll(): Record<string, string> {
    const rows = db.prepare('SELECT key,value FROM settings').all() as { key: string; value: string }[];
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },
};

export default { users, courses, lectures, enrollments, attendance, invites, settings };
