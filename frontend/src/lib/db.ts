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
  records: { [studentId: string]: 'present' | 'absent' | 'late' | 'remote' };
  markedBy: string;
  createdAt: string;
}

/** A live class session (one per lecture/date). Drives QR, network, and online attendance. */
export interface AttendanceSession {
  id: string;
  courseId: string;
  lectureId?: string;
  date: string;
  title: string;
  /** 'in_person' | 'online' */
  type: string;
  /** 'active' | 'ended' */
  status: string;
  /** JSON array: ['manual','network','qr','online'] */
  methods: string[];
  qrToken?: string;
  qrExpiresAt?: string;
  createdBy: string;
  createdAt: string;
  endedAt?: string;
}

/** Per-course rules for attendance. */
export interface AttendancePolicy {
  id: string;
  courseId: string;
  /** Minimum % required to pass */
  minAttendancePercent: number;
  /** Max % of sessions allowed remotely */
  remoteAllowPercent: number;
  /** Require proof for online attendance */
  requireProofForOnline: boolean;
  /** 'webcam' | 'quiz' | 'either' | 'none' */
  proofType: string;
  /** Minutes between webcam attention checks */
  webcamCheckInterval: number;
  /** JSON array of allowed methods */
  allowedMethods: string[];
  updatedAt: string;
}

/** Individual student check-in for a session. */
export interface AttendanceCheckin {
  id: string;
  sessionId: string;
  courseId: string;
  studentId: string;
  /** 'manual' | 'network' | 'qr' | 'online' */
  method: string;
  /** 'present' | 'remote' | 'late' */
  status: string;
  proofType?: string;
  checkedInAt: string;
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
// `next build` evaluates this module in ~19 parallel worker processes. Make each
// one wait for the write lock instead of failing immediately with SQLITE_BUSY.
db.pragma('busy_timeout = 15000');

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

  CREATE TABLE IF NOT EXISTS attendance_sessions (
    id          TEXT PRIMARY KEY,
    courseId    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lectureId   TEXT REFERENCES lectures(id) ON DELETE SET NULL,
    date        TEXT NOT NULL,
    title       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'in_person',
    status      TEXT NOT NULL DEFAULT 'active',
    methods     TEXT NOT NULL DEFAULT '["manual"]',
    qrToken     TEXT UNIQUE,
    qrExpiresAt TEXT,
    createdBy   TEXT NOT NULL,
    createdAt   TEXT NOT NULL,
    endedAt     TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance_policies (
    id                    TEXT PRIMARY KEY,
    courseId              TEXT UNIQUE NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    minAttendancePercent  INTEGER NOT NULL DEFAULT 75,
    remoteAllowPercent    INTEGER NOT NULL DEFAULT 30,
    requireProofForOnline INTEGER NOT NULL DEFAULT 1,
    proofType             TEXT NOT NULL DEFAULT 'either',
    webcamCheckInterval   INTEGER NOT NULL DEFAULT 15,
    allowedMethods        TEXT NOT NULL DEFAULT '["manual","network","qr","online"]',
    updatedAt             TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance_checkins (
    id          TEXT PRIMARY KEY,
    sessionId   TEXT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    courseId    TEXT NOT NULL,
    studentId   TEXT NOT NULL,
    method      TEXT NOT NULL DEFAULT 'manual',
    status      TEXT NOT NULL DEFAULT 'present',
    proofType   TEXT,
    checkedInAt TEXT NOT NULL,
    UNIQUE(sessionId, studentId)
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id        TEXT PRIMARY KEY,
    lectureId TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    courseId  TEXT NOT NULL REFERENCES courses(id)  ON DELETE CASCADE,
    title     TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quiz_questions (
    id            TEXT PRIMARY KEY,
    quizId        TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question      TEXT NOT NULL,
    options       TEXT NOT NULL DEFAULT '[]',
    correctAnswer INTEGER NOT NULL DEFAULT 0,
    explanation   TEXT NOT NULL DEFAULT '',
    "order"       INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id          TEXT PRIMARY KEY,
    quizId      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    userId      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answers     TEXT NOT NULL DEFAULT '{}',
    score       INTEGER NOT NULL DEFAULT 0,
    total       INTEGER NOT NULL DEFAULT 0,
    passed      INTEGER NOT NULL DEFAULT 0,
    submittedAt TEXT NOT NULL,
    UNIQUE(quizId, userId)
  );

  CREATE TABLE IF NOT EXISTS timetable (
    id        TEXT PRIMARY KEY,
    courseId  TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacherId TEXT NOT NULL REFERENCES users(id),
    day       TEXT NOT NULL CHECK(day IN ('monday','tuesday','wednesday','thursday','friday','saturday')),
    startTime TEXT NOT NULL,
    endTime   TEXT NOT NULL,
    room      TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS grievances (
    id          TEXT PRIMARY KEY,
    submittedBy TEXT NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'general',
    priority    TEXT NOT NULL DEFAULT 'medium',
    status      TEXT NOT NULL DEFAULT 'open',
    adminNote   TEXT NOT NULL DEFAULT '',
    createdAt   TEXT NOT NULL,
    updatedAt   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id            TEXT PRIMARY KEY,
    studentId     TEXT NOT NULL REFERENCES users(id),
    courseId      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    teacherId     TEXT NOT NULL REFERENCES users(id),
    subjectRating INTEGER NOT NULL DEFAULT 5,
    teacherRating INTEGER NOT NULL DEFAULT 5,
    comment       TEXT NOT NULL DEFAULT '',
    anonymous     INTEGER NOT NULL DEFAULT 0,
    createdAt     TEXT NOT NULL,
    UNIQUE(studentId, courseId)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id          TEXT PRIMARY KEY,
    courseId    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    duration    INTEGER NOT NULL DEFAULT 60,
    totalMarks  INTEGER NOT NULL DEFAULT 100,
    status      TEXT NOT NULL DEFAULT 'draft',
    createdBy   TEXT NOT NULL REFERENCES users(id),
    createdAt   TEXT NOT NULL,
    startsAt    TEXT,
    endsAt      TEXT
  );

  CREATE TABLE IF NOT EXISTS exam_questions (
    id             TEXT PRIMARY KEY,
    examId         TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    question       TEXT NOT NULL,
    maxMarks       INTEGER NOT NULL DEFAULT 10,
    expectedAnswer TEXT NOT NULL DEFAULT '',
    "order"        INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS exam_submissions (
    id          TEXT PRIMARY KEY,
    examId      TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    studentId   TEXT NOT NULL REFERENCES users(id),
    status      TEXT NOT NULL DEFAULT 'in_progress',
    totalMarks  INTEGER,
    startedAt   TEXT NOT NULL,
    submittedAt TEXT,
    UNIQUE(examId, studentId)
  );

  CREATE TABLE IF NOT EXISTS exam_answers (
    id               TEXT PRIMARY KEY,
    submissionId     TEXT NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
    questionId       TEXT NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
    answer           TEXT NOT NULL DEFAULT '',
    marksAwarded     INTEGER,
    teacherFeedback  TEXT NOT NULL DEFAULT '',
    aiSuggestedMarks INTEGER,
    aiConfidence     REAL,
    UNIQUE(submissionId, questionId)
  );
`);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Seed default data if tables are empty.
// Wrapped in an IMMEDIATE transaction so that when many processes evaluate this
// module at once (next build workers), exactly one acquires the write lock and
// seeds; the others block on it, then re-read count > 0 and no-op. This removes
// the TOCTOU race that produced "UNIQUE constraint failed: users.email".
const seed = db.transaction(() => {
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
});
seed.immediate();

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
    ...(row as unknown as Enrollment),
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
    ...(row as unknown as AttendanceRecord),
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

// ─── Quizzes ──────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string; quizId: string; question: string;
  options: string[]; correctAnswer: number; explanation: string; order: number;
}
export interface Quiz {
  id: string; lectureId: string; courseId: string; title: string; createdAt: string;
  questions?: QuizQuestion[];
}

function parseQuestion(row: Record<string, unknown>): QuizQuestion {
  return { ...(row as unknown as QuizQuestion), options: JSON.parse((row.options as string) || '[]') };
}

export const quizzes = {
  getByLecture(lectureId: string): Quiz[] {
    return db.prepare('SELECT * FROM quizzes WHERE lectureId=? ORDER BY createdAt DESC').all(lectureId) as Quiz[];
  },
  getById(id: string): Quiz | undefined {
    const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(id) as Quiz | undefined;
    if (!quiz) return undefined;
    quiz.questions = (db.prepare('SELECT * FROM quiz_questions WHERE quizId=? ORDER BY "order" ASC').all(id) as Record<string, unknown>[]).map(parseQuestion);
    return quiz;
  },
  create(data: Omit<Quiz, 'id' | 'createdAt'>): Quiz {
    const id = generateId(); const createdAt = new Date().toISOString();
    db.prepare('INSERT INTO quizzes (id,lectureId,courseId,title,createdAt) VALUES (?,?,?,?,?)').run(id, data.lectureId, data.courseId, data.title, createdAt);
    return { ...data, id, createdAt, questions: [] };
  },
  addQuestion(quizId: string, data: Omit<QuizQuestion, 'id' | 'quizId'>): QuizQuestion {
    const id = generateId();
    db.prepare('INSERT INTO quiz_questions (id,quizId,question,options,correctAnswer,explanation,"order") VALUES (?,?,?,?,?,?,?)').run(id, quizId, data.question, JSON.stringify(data.options), data.correctAnswer, data.explanation || '', data.order);
    return { ...data, id, quizId };
  },
  deleteQuestion(id: string): boolean {
    return db.prepare('DELETE FROM quiz_questions WHERE id=?').run(id).changes > 0;
  },
  delete(id: string): boolean {
    return db.prepare('DELETE FROM quizzes WHERE id=?').run(id).changes > 0;
  },
};

// ─── Attendance sessions ──────────────────────────────────────────────────────

function parseSession(row: Record<string, unknown>): AttendanceSession {
  return {
    ...(row as unknown as AttendanceSession),
    methods: JSON.parse((row.methods as string) || '["manual"]'),
  };
}

export const attendanceSessions = {
  getById(id: string): AttendanceSession | undefined {
    const row = db.prepare('SELECT * FROM attendance_sessions WHERE id=?').get(id) as Record<string, unknown> | undefined;
    return row ? parseSession(row) : undefined;
  },
  getByCourse(courseId: string): AttendanceSession[] {
    return (db.prepare('SELECT * FROM attendance_sessions WHERE courseId=? ORDER BY createdAt DESC').all(courseId) as Record<string, unknown>[]).map(parseSession);
  },
  getActive(courseId: string): AttendanceSession | undefined {
    const row = db.prepare("SELECT * FROM attendance_sessions WHERE courseId=? AND status='active' ORDER BY createdAt DESC LIMIT 1").get(courseId) as Record<string, unknown> | undefined;
    return row ? parseSession(row) : undefined;
  },
  getByQrToken(token: string): AttendanceSession | undefined {
    const row = db.prepare('SELECT * FROM attendance_sessions WHERE qrToken=?').get(token) as Record<string, unknown> | undefined;
    return row ? parseSession(row) : undefined;
  },
  create(data: Omit<AttendanceSession, 'id' | 'createdAt'>): AttendanceSession {
    const id = generateId();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO attendance_sessions (id,courseId,lectureId,date,title,type,status,methods,qrToken,qrExpiresAt,createdBy,createdAt,endedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).run(id, data.courseId, data.lectureId ?? null, data.date, data.title, data.type, data.status,
      JSON.stringify(data.methods), data.qrToken ?? null, data.qrExpiresAt ?? null, data.createdBy, createdAt, data.endedAt ?? null);
    return { ...data, id, createdAt };
  },
  update(id: string, updates: Partial<AttendanceSession>): AttendanceSession | null {
    const existing = attendanceSessions.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    db.prepare(
      'UPDATE attendance_sessions SET status=?,methods=?,qrToken=?,qrExpiresAt=?,endedAt=?,title=?,type=? WHERE id=?'
    ).run(merged.status, JSON.stringify(merged.methods), merged.qrToken ?? null, merged.qrExpiresAt ?? null, merged.endedAt ?? null, merged.title, merged.type, id);
    return merged;
  },
};

// ─── Attendance policies ──────────────────────────────────────────────────────

function parsePolicy(row: Record<string, unknown>): AttendancePolicy {
  return {
    ...(row as unknown as AttendancePolicy),
    requireProofForOnline: !!(row.requireProofForOnline as number),
    allowedMethods: JSON.parse((row.allowedMethods as string) || '["manual","network","qr","online"]'),
  };
}

export const attendancePolicies = {
  getByCourse(courseId: string): AttendancePolicy | undefined {
    const row = db.prepare('SELECT * FROM attendance_policies WHERE courseId=?').get(courseId) as Record<string, unknown> | undefined;
    return row ? parsePolicy(row) : undefined;
  },
  upsert(courseId: string, data: Partial<Omit<AttendancePolicy, 'id' | 'courseId' | 'updatedAt'>>): AttendancePolicy {
    const existing = attendancePolicies.getByCourse(courseId);
    const defaults: Omit<AttendancePolicy, 'id' | 'courseId' | 'updatedAt'> = {
      minAttendancePercent: 75, remoteAllowPercent: 30, requireProofForOnline: true,
      proofType: 'either', webcamCheckInterval: 15, allowedMethods: ['manual', 'network', 'qr', 'online'],
    };
    const merged = { ...defaults, ...existing ? {
      minAttendancePercent: existing.minAttendancePercent,
      remoteAllowPercent: existing.remoteAllowPercent,
      requireProofForOnline: existing.requireProofForOnline,
      proofType: existing.proofType,
      webcamCheckInterval: existing.webcamCheckInterval,
      allowedMethods: existing.allowedMethods,
    } : {}, ...data };
    const updatedAt = new Date().toISOString();
    if (existing) {
      db.prepare(
        'UPDATE attendance_policies SET minAttendancePercent=?,remoteAllowPercent=?,requireProofForOnline=?,proofType=?,webcamCheckInterval=?,allowedMethods=?,updatedAt=? WHERE courseId=?'
      ).run(merged.minAttendancePercent, merged.remoteAllowPercent, merged.requireProofForOnline ? 1 : 0,
        merged.proofType, merged.webcamCheckInterval, JSON.stringify(merged.allowedMethods), updatedAt, courseId);
      return { ...existing, ...merged, updatedAt };
    }
    const id = generateId();
    db.prepare(
      'INSERT INTO attendance_policies (id,courseId,minAttendancePercent,remoteAllowPercent,requireProofForOnline,proofType,webcamCheckInterval,allowedMethods,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(id, courseId, merged.minAttendancePercent, merged.remoteAllowPercent, merged.requireProofForOnline ? 1 : 0,
      merged.proofType, merged.webcamCheckInterval, JSON.stringify(merged.allowedMethods), updatedAt);
    return { id, courseId, ...merged, updatedAt };
  },
};

// ─── Attendance check-ins ─────────────────────────────────────────────────────

export const attendanceCheckins = {
  getBySession(sessionId: string): AttendanceCheckin[] {
    return db.prepare('SELECT * FROM attendance_checkins WHERE sessionId=? ORDER BY checkedInAt ASC').all(sessionId) as AttendanceCheckin[];
  },
  getByStudent(studentId: string, courseId: string): AttendanceCheckin[] {
    return db.prepare('SELECT * FROM attendance_checkins WHERE studentId=? AND courseId=? ORDER BY checkedInAt DESC').all(studentId, courseId) as AttendanceCheckin[];
  },
  upsert(data: Omit<AttendanceCheckin, 'id'>): AttendanceCheckin {
    const existing = db.prepare('SELECT * FROM attendance_checkins WHERE sessionId=? AND studentId=?').get(data.sessionId, data.studentId) as AttendanceCheckin | undefined;
    if (existing) {
      db.prepare('UPDATE attendance_checkins SET method=?,status=?,proofType=?,checkedInAt=? WHERE id=?')
        .run(data.method, data.status, data.proofType ?? null, data.checkedInAt, existing.id);
      return { ...existing, ...data };
    }
    const id = generateId();
    db.prepare(
      'INSERT INTO attendance_checkins (id,sessionId,courseId,studentId,method,status,proofType,checkedInAt) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, data.sessionId, data.courseId, data.studentId, data.method, data.status, data.proofType ?? null, data.checkedInAt);
    return { ...data, id };
  },
  getStudentSummary(courseId: string, studentId: string): { total: number; present: number; remote: number; percentage: number } {
    // Count from both checkins and legacy attendance records
    const sessions = attendanceSessions.getByCourse(courseId).filter(s => s.status === 'ended');
    let present = 0, remote = 0;
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length) {
      const rows = db.prepare(
        `SELECT status FROM attendance_checkins WHERE studentId=? AND sessionId IN (${sessionIds.map(() => '?').join(',')})`
      ).all(studentId, ...sessionIds) as { status: string }[];
      for (const r of rows) {
        if (r.status === 'present' || r.status === 'late') present++;
        if (r.status === 'remote') remote++;
      }
    }
    const total = sessions.length;
    return { total, present, remote, percentage: total > 0 ? Math.round(((present + remote) / total) * 100) : 0 };
  },
};

// ─── Quiz attempts ────────────────────────────────────────────────────────────

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  answers: Record<number, number>; // questionIndex → chosen option index
  score: number;
  total: number;
  passed: boolean;
  submittedAt: string;
}

function parseAttempt(row: Record<string, unknown>): QuizAttempt {
  return {
    ...(row as unknown as QuizAttempt),
    answers: JSON.parse((row.answers as string) || '{}'),
    passed: !!(row.passed as number),
  };
}

export const quizAttempts = {
  getByUser(quizId: string, userId: string): QuizAttempt | undefined {
    const row = db.prepare('SELECT * FROM quiz_attempts WHERE quizId=? AND userId=?').get(quizId, userId) as Record<string, unknown> | undefined;
    return row ? parseAttempt(row) : undefined;
  },
  getByQuiz(quizId: string): QuizAttempt[] {
    return (db.prepare('SELECT * FROM quiz_attempts WHERE quizId=? ORDER BY submittedAt DESC').all(quizId) as Record<string, unknown>[]).map(parseAttempt);
  },
  submit(data: Omit<QuizAttempt, 'id'>): QuizAttempt {
    const existing = quizAttempts.getByUser(data.quizId, data.userId);
    if (existing) {
      db.prepare('UPDATE quiz_attempts SET answers=?,score=?,total=?,passed=?,submittedAt=? WHERE id=?')
        .run(JSON.stringify(data.answers), data.score, data.total, data.passed ? 1 : 0, data.submittedAt, existing.id);
      return { ...existing, ...data };
    }
    const id = generateId();
    db.prepare('INSERT INTO quiz_attempts (id,quizId,userId,answers,score,total,passed,submittedAt) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, data.quizId, data.userId, JSON.stringify(data.answers), data.score, data.total, data.passed ? 1 : 0, data.submittedAt);
    return { ...data, id };
  },
};

// ─── Timetable ────────────────────────────────────────────────────────────────

export interface TimetableEntry {
  id: string;
  courseId: string;
  teacherId: string;
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  startTime: string;
  endTime: string;
  room: string;
  createdAt: string;
}

export const timetable = {
  getAll(): TimetableEntry[] {
    return db.prepare('SELECT * FROM timetable ORDER BY day, startTime').all() as TimetableEntry[];
  },
  getByCourse(courseId: string): TimetableEntry[] {
    return db.prepare('SELECT * FROM timetable WHERE courseId=? ORDER BY day, startTime').all(courseId) as TimetableEntry[];
  },
  getByTeacher(teacherId: string): TimetableEntry[] {
    return db.prepare('SELECT * FROM timetable WHERE teacherId=? ORDER BY day, startTime').all(teacherId) as TimetableEntry[];
  },
  create(data: Omit<TimetableEntry, 'id' | 'createdAt'>): TimetableEntry {
    const id = generateId();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO timetable (id,courseId,teacherId,day,startTime,endTime,room,createdAt) VALUES (?,?,?,?,?,?,?,?)'
    ).run(id, data.courseId, data.teacherId, data.day, data.startTime, data.endTime, data.room, createdAt);
    return { ...data, id, createdAt };
  },
  delete(id: string): boolean {
    return db.prepare('DELETE FROM timetable WHERE id=?').run(id).changes > 0;
  },
};

// ─── Grievances ───────────────────────────────────────────────────────────────

export interface Grievance {
  id: string;
  submittedBy: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export const grievances = {
  getAll(): Grievance[] {
    return db.prepare('SELECT * FROM grievances ORDER BY createdAt DESC').all() as Grievance[];
  },
  getByUser(userId: string): Grievance[] {
    return db.prepare('SELECT * FROM grievances WHERE submittedBy=? ORDER BY createdAt DESC').all(userId) as Grievance[];
  },
  getById(id: string): Grievance | undefined {
    return db.prepare('SELECT * FROM grievances WHERE id=?').get(id) as Grievance | undefined;
  },
  create(data: Omit<Grievance, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'adminNote'>): Grievance {
    const id = generateId();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO grievances (id,submittedBy,title,description,category,priority,status,adminNote,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(id, data.submittedBy, data.title, data.description, data.category, data.priority, 'open', '', now, now);
    return { ...data, id, status: 'open', adminNote: '', createdAt: now, updatedAt: now };
  },
  update(id: string, updates: Partial<Pick<Grievance, 'status' | 'adminNote'>>): Grievance | null {
    const existing = grievances.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    db.prepare('UPDATE grievances SET status=?,adminNote=?,updatedAt=? WHERE id=?')
      .run(merged.status, merged.adminNote, merged.updatedAt, id);
    return merged;
  },
};

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface Feedback {
  id: string;
  studentId: string;
  courseId: string;
  teacherId: string;
  subjectRating: number;
  teacherRating: number;
  comment: string;
  anonymous: boolean;
  createdAt: string;
}

function parseFeedback(row: Record<string, unknown>): Feedback {
  return { ...(row as unknown as Feedback), anonymous: !!(row.anonymous as number) };
}

export const feedbackStore = {
  getAll(): Feedback[] {
    return (db.prepare('SELECT * FROM feedback ORDER BY createdAt DESC').all() as Record<string, unknown>[]).map(parseFeedback);
  },
  getByCourse(courseId: string): Feedback[] {
    return (db.prepare('SELECT * FROM feedback WHERE courseId=? ORDER BY createdAt DESC').all(courseId) as Record<string, unknown>[]).map(parseFeedback);
  },
  getByTeacher(teacherId: string): Feedback[] {
    return (db.prepare('SELECT * FROM feedback WHERE teacherId=? ORDER BY createdAt DESC').all(teacherId) as Record<string, unknown>[]).map(parseFeedback);
  },
  getByStudent(studentId: string): Feedback[] {
    return (db.prepare('SELECT * FROM feedback WHERE studentId=? ORDER BY createdAt DESC').all(studentId) as Record<string, unknown>[]).map(parseFeedback);
  },
  getByStudentAndCourse(studentId: string, courseId: string): Feedback | undefined {
    const row = db.prepare('SELECT * FROM feedback WHERE studentId=? AND courseId=?').get(studentId, courseId) as Record<string, unknown> | undefined;
    return row ? parseFeedback(row) : undefined;
  },
  create(data: Omit<Feedback, 'id' | 'createdAt'>): Feedback {
    const id = generateId();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO feedback (id,studentId,courseId,teacherId,subjectRating,teacherRating,comment,anonymous,createdAt) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(id, data.studentId, data.courseId, data.teacherId, data.subjectRating, data.teacherRating, data.comment, data.anonymous ? 1 : 0, createdAt);
    return { ...data, id, createdAt };
  },
};

// ─── Exams ────────────────────────────────────────────────────────────────────

export interface Exam {
  id: string;
  courseId: string;
  title: string;
  description: string;
  duration: number;
  totalMarks: number;
  status: 'draft' | 'active' | 'closed';
  createdBy: string;
  createdAt: string;
  startsAt?: string;
  endsAt?: string;
}

export interface ExamQuestion {
  id: string;
  examId: string;
  question: string;
  maxMarks: number;
  expectedAnswer: string;
  order: number;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId: string;
  status: 'in_progress' | 'submitted' | 'marked';
  totalMarks?: number;
  startedAt: string;
  submittedAt?: string;
}

export interface ExamAnswer {
  id: string;
  submissionId: string;
  questionId: string;
  answer: string;
  marksAwarded?: number;
  teacherFeedback: string;
  aiSuggestedMarks?: number;
  aiConfidence?: number;
}

export const exams = {
  getAll(): Exam[] {
    return db.prepare('SELECT * FROM exams ORDER BY createdAt DESC').all() as Exam[];
  },
  getByCourse(courseId: string): Exam[] {
    return db.prepare('SELECT * FROM exams WHERE courseId=? ORDER BY createdAt DESC').all(courseId) as Exam[];
  },
  getById(id: string): Exam | undefined {
    return db.prepare('SELECT * FROM exams WHERE id=?').get(id) as Exam | undefined;
  },
  create(data: Omit<Exam, 'id' | 'createdAt'>): Exam {
    const id = generateId();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO exams (id,courseId,title,description,duration,totalMarks,status,createdBy,createdAt,startsAt,endsAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(id, data.courseId, data.title, data.description, data.duration, data.totalMarks, data.status, data.createdBy, createdAt, data.startsAt ?? null, data.endsAt ?? null);
    return { ...data, id, createdAt };
  },
  update(id: string, updates: Partial<Exam>): Exam | null {
    const existing = exams.getById(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    db.prepare('UPDATE exams SET title=?,description=?,duration=?,totalMarks=?,status=?,startsAt=?,endsAt=? WHERE id=?')
      .run(merged.title, merged.description, merged.duration, merged.totalMarks, merged.status, merged.startsAt ?? null, merged.endsAt ?? null, id);
    return merged;
  },
  delete(id: string): boolean {
    return db.prepare('DELETE FROM exams WHERE id=?').run(id).changes > 0;
  },
};

export const examQuestions = {
  getByExam(examId: string): ExamQuestion[] {
    return db.prepare('SELECT * FROM exam_questions WHERE examId=? ORDER BY "order" ASC').all(examId) as ExamQuestion[];
  },
  getById(id: string): ExamQuestion | undefined {
    return db.prepare('SELECT * FROM exam_questions WHERE id=?').get(id) as ExamQuestion | undefined;
  },
  create(data: Omit<ExamQuestion, 'id'>): ExamQuestion {
    const id = generateId();
    db.prepare(
      'INSERT INTO exam_questions (id,examId,question,maxMarks,expectedAnswer,"order") VALUES (?,?,?,?,?,?)'
    ).run(id, data.examId, data.question, data.maxMarks, data.expectedAnswer, data.order);
    return { ...data, id };
  },
  delete(id: string): boolean {
    return db.prepare('DELETE FROM exam_questions WHERE id=?').run(id).changes > 0;
  },
};

export const examSubmissions = {
  getByExam(examId: string): ExamSubmission[] {
    return db.prepare('SELECT * FROM exam_submissions WHERE examId=? ORDER BY submittedAt DESC').all(examId) as ExamSubmission[];
  },
  getByStudent(examId: string, studentId: string): ExamSubmission | undefined {
    return db.prepare('SELECT * FROM exam_submissions WHERE examId=? AND studentId=?').get(examId, studentId) as ExamSubmission | undefined;
  },
  getById(id: string): ExamSubmission | undefined {
    return db.prepare('SELECT * FROM exam_submissions WHERE id=?').get(id) as ExamSubmission | undefined;
  },
  start(examId: string, studentId: string): ExamSubmission {
    const existing = examSubmissions.getByStudent(examId, studentId);
    if (existing) return existing;
    const id = generateId();
    const startedAt = new Date().toISOString();
    db.prepare('INSERT INTO exam_submissions (id,examId,studentId,status,startedAt) VALUES (?,?,?,?,?)')
      .run(id, examId, studentId, 'in_progress', startedAt);
    return { id, examId, studentId, status: 'in_progress', startedAt };
  },
  submit(id: string): ExamSubmission | null {
    const existing = examSubmissions.getById(id);
    if (!existing) return null;
    const submittedAt = new Date().toISOString();
    db.prepare("UPDATE exam_submissions SET status='submitted',submittedAt=? WHERE id=?").run(submittedAt, id);
    return { ...existing, status: 'submitted', submittedAt };
  },
  mark(id: string, totalMarks: number): ExamSubmission | null {
    const existing = examSubmissions.getById(id);
    if (!existing) return null;
    db.prepare("UPDATE exam_submissions SET status='marked',totalMarks=? WHERE id=?").run(totalMarks, id);
    return { ...existing, status: 'marked', totalMarks };
  },
};

export const examAnswers = {
  getBySubmission(submissionId: string): ExamAnswer[] {
    return db.prepare('SELECT * FROM exam_answers WHERE submissionId=?').all(submissionId) as ExamAnswer[];
  },
  upsert(data: Omit<ExamAnswer, 'id'>): ExamAnswer {
    const existing = db.prepare('SELECT * FROM exam_answers WHERE submissionId=? AND questionId=?').get(data.submissionId, data.questionId) as ExamAnswer | undefined;
    if (existing) {
      db.prepare('UPDATE exam_answers SET answer=?,marksAwarded=?,teacherFeedback=?,aiSuggestedMarks=?,aiConfidence=? WHERE id=?')
        .run(data.answer, data.marksAwarded ?? null, data.teacherFeedback, data.aiSuggestedMarks ?? null, data.aiConfidence ?? null, existing.id);
      return { ...existing, ...data };
    }
    const id = generateId();
    db.prepare('INSERT INTO exam_answers (id,submissionId,questionId,answer,marksAwarded,teacherFeedback,aiSuggestedMarks,aiConfidence) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, data.submissionId, data.questionId, data.answer, data.marksAwarded ?? null, data.teacherFeedback, data.aiSuggestedMarks ?? null, data.aiConfidence ?? null);
    return { ...data, id };
  },
};

export default { users, courses, lectures, enrollments, attendance, attendanceSessions, attendancePolicies, attendanceCheckins, invites, settings, quizzes, quizAttempts, timetable, grievances, feedbackStore, exams, examQuestions, examSubmissions, examAnswers };
