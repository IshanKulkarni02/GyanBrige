module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[project]/src/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "attendance",
    ()=>attendance,
    "courses",
    ()=>courses,
    "default",
    ()=>__TURBOPACK__default__export__,
    "enrollments",
    ()=>enrollments,
    "invites",
    ()=>invites,
    "lectures",
    ()=>lectures,
    "users",
    ()=>users
]);
/**
 * Simple JSON file-based database for LMS
 * Can be easily upgraded to SQLite, PostgreSQL, or MongoDB later
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
;
;
const DB_PATH = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), 'data');
const USERS_FILE = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(DB_PATH, 'users.json');
const COURSES_FILE = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(DB_PATH, 'courses.json');
const LECTURES_FILE = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(DB_PATH, 'lectures.json');
const ENROLLMENTS_FILE = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(DB_PATH, 'enrollments.json');
const ATTENDANCE_FILE = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(DB_PATH, 'attendance.json');
const INVITES_FILE = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(DB_PATH, 'invites.json');
// Ensure data directory exists
if (!__TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].existsSync(DB_PATH)) {
    __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].mkdirSync(DB_PATH, {
        recursive: true
    });
}
// Helper functions
function readJSON(filePath, defaultValue = []) {
    try {
        if (!__TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].existsSync(filePath)) {
            __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
            return defaultValue;
        }
        const data = __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch  {
        return defaultValue;
    }
}
function writeJSON(filePath, data) {
    __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["default"].writeFileSync(filePath, JSON.stringify(data, null, 2));
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
// Initialize with seed data if empty
function initializeDB() {
    const users = readJSON(USERS_FILE);
    if (users.length === 0) {
        const seedUsers = [
            {
                id: 'u1',
                name: 'Arjun Kumar',
                email: 'student@gyan.com',
                password: 'student123',
                role: 'student',
                createdAt: new Date().toISOString()
            },
            {
                id: 'u2',
                name: 'Dr. Priya Sharma',
                email: 'teacher@gyan.com',
                password: 'teacher123',
                role: 'teacher',
                createdAt: new Date().toISOString()
            },
            {
                id: 'u3',
                name: 'Rahul Singh',
                email: 'admin@gyan.com',
                password: 'admin123',
                role: 'admin',
                createdAt: new Date().toISOString()
            },
            {
                id: 'u4',
                name: 'Meera Patel',
                email: 'meera@gyan.com',
                password: 'password123',
                role: 'student',
                createdAt: new Date().toISOString()
            },
            {
                id: 'u5',
                name: 'Vikram Joshi',
                email: 'vikram@gyan.com',
                password: 'password123',
                role: 'student',
                createdAt: new Date().toISOString()
            }
        ];
        writeJSON(USERS_FILE, seedUsers);
    }
    const courses = readJSON(COURSES_FILE);
    if (courses.length === 0) {
        const seedCourses = [
            {
                id: 'c1',
                name: 'Mathematics',
                description: 'Algebra, Calculus, and Geometry',
                icon: '📐',
                color: 'from-emerald-500 to-teal-500',
                teacherId: 'u2',
                createdAt: new Date().toISOString()
            },
            {
                id: 'c2',
                name: 'Physics',
                description: 'Mechanics, Thermodynamics, and Optics',
                icon: '⚡',
                color: 'from-purple-500 to-indigo-500',
                teacherId: 'u2',
                createdAt: new Date().toISOString()
            },
            {
                id: 'c3',
                name: 'Chemistry',
                description: 'Organic, Inorganic, and Physical Chemistry',
                icon: '🧪',
                color: 'from-amber-500 to-orange-500',
                teacherId: 'u2',
                createdAt: new Date().toISOString()
            },
            {
                id: 'c4',
                name: 'Biology',
                description: 'Cell Biology, Genetics, and Ecology',
                icon: '🧬',
                color: 'from-green-500 to-emerald-500',
                teacherId: 'u2',
                createdAt: new Date().toISOString()
            },
            {
                id: 'c5',
                name: 'English',
                description: 'Grammar, Literature, and Writing',
                icon: '📚',
                color: 'from-blue-500 to-cyan-500',
                teacherId: 'u2',
                createdAt: new Date().toISOString()
            },
            {
                id: 'c6',
                name: 'History',
                description: 'World History and Indian History',
                icon: '🏛️',
                color: 'from-rose-500 to-pink-500',
                teacherId: 'u2',
                createdAt: new Date().toISOString()
            }
        ];
        writeJSON(COURSES_FILE, seedCourses);
    }
    const lectures = readJSON(LECTURES_FILE);
    if (lectures.length === 0) {
        const seedLectures = [
            {
                id: 'l1',
                courseId: 'c1',
                title: 'Introduction to Algebra',
                description: 'Basic algebraic concepts',
                duration: 45,
                notes: '# Algebra Basics\n\n- Variables and constants\n- Linear equations\n- Quadratic equations',
                order: 1,
                createdAt: new Date().toISOString()
            },
            {
                id: 'l2',
                courseId: 'c1',
                title: 'Calculus Fundamentals',
                description: 'Limits and derivatives',
                duration: 50,
                notes: '# Calculus\n\n- Understanding limits\n- Derivatives\n- Integration basics',
                order: 2,
                createdAt: new Date().toISOString()
            },
            {
                id: 'l3',
                courseId: 'c1',
                title: 'Geometry Basics',
                description: 'Shapes and theorems',
                duration: 40,
                notes: '# Geometry\n\n- Types of angles\n- Triangles\n- Circles',
                order: 3,
                createdAt: new Date().toISOString()
            },
            {
                id: 'l4',
                courseId: 'c2',
                title: 'Laws of Motion',
                description: 'Newton\'s three laws',
                duration: 55,
                notes: '# Newton\'s Laws\n\n1. First Law (Inertia)\n2. Second Law (F=ma)\n3. Third Law (Action-Reaction)',
                order: 1,
                createdAt: new Date().toISOString()
            },
            {
                id: 'l5',
                courseId: 'c2',
                title: 'Thermodynamics',
                description: 'Heat and energy',
                duration: 48,
                notes: '# Thermodynamics\n\n- Heat transfer\n- Laws of thermodynamics\n- Entropy',
                order: 2,
                createdAt: new Date().toISOString()
            }
        ];
        writeJSON(LECTURES_FILE, seedLectures);
    }
    const enrollments = readJSON(ENROLLMENTS_FILE);
    if (enrollments.length === 0) {
        const seedEnrollments = [
            {
                id: 'e1',
                userId: 'u1',
                courseId: 'c1',
                progress: 66,
                completedLectures: [
                    'l1',
                    'l2'
                ],
                enrolledAt: new Date().toISOString()
            },
            {
                id: 'e2',
                userId: 'u1',
                courseId: 'c2',
                progress: 50,
                completedLectures: [
                    'l4'
                ],
                enrolledAt: new Date().toISOString()
            },
            {
                id: 'e3',
                userId: 'u4',
                courseId: 'c1',
                progress: 33,
                completedLectures: [
                    'l1'
                ],
                enrolledAt: new Date().toISOString()
            },
            {
                id: 'e4',
                userId: 'u5',
                courseId: 'c1',
                progress: 100,
                completedLectures: [
                    'l1',
                    'l2',
                    'l3'
                ],
                enrolledAt: new Date().toISOString()
            }
        ];
        writeJSON(ENROLLMENTS_FILE, seedEnrollments);
    }
}
// Initialize on import
initializeDB();
const users = {
    getAll: ()=>readJSON(USERS_FILE),
    getById: (id)=>{
        const all = readJSON(USERS_FILE);
        return all.find((u)=>u.id === id);
    },
    getByEmail: (email)=>{
        const all = readJSON(USERS_FILE);
        return all.find((u)=>u.email.toLowerCase() === email.toLowerCase());
    },
    create: (user)=>{
        const all = readJSON(USERS_FILE);
        const newUser = {
            ...user,
            id: generateId(),
            createdAt: new Date().toISOString()
        };
        all.push(newUser);
        writeJSON(USERS_FILE, all);
        return newUser;
    },
    update: (id, updates)=>{
        const all = readJSON(USERS_FILE);
        const index = all.findIndex((u)=>u.id === id);
        if (index === -1) return null;
        all[index] = {
            ...all[index],
            ...updates
        };
        writeJSON(USERS_FILE, all);
        return all[index];
    },
    delete: (id)=>{
        const all = readJSON(USERS_FILE);
        const filtered = all.filter((u)=>u.id !== id);
        if (filtered.length === all.length) return false;
        writeJSON(USERS_FILE, filtered);
        return true;
    },
    getByRole: (role)=>{
        const all = readJSON(USERS_FILE);
        return all.filter((u)=>u.role === role);
    }
};
const courses = {
    getAll: ()=>readJSON(COURSES_FILE),
    getById: (id)=>{
        const all = readJSON(COURSES_FILE);
        return all.find((c)=>c.id === id);
    },
    getByTeacher: (teacherId)=>{
        const all = readJSON(COURSES_FILE);
        return all.filter((c)=>c.teacherId === teacherId);
    },
    create: (course)=>{
        const all = readJSON(COURSES_FILE);
        const newCourse = {
            ...course,
            id: generateId(),
            createdAt: new Date().toISOString()
        };
        all.push(newCourse);
        writeJSON(COURSES_FILE, all);
        return newCourse;
    },
    update: (id, updates)=>{
        const all = readJSON(COURSES_FILE);
        const index = all.findIndex((c)=>c.id === id);
        if (index === -1) return null;
        all[index] = {
            ...all[index],
            ...updates
        };
        writeJSON(COURSES_FILE, all);
        return all[index];
    },
    delete: (id)=>{
        const all = readJSON(COURSES_FILE);
        const filtered = all.filter((c)=>c.id !== id);
        if (filtered.length === all.length) return false;
        writeJSON(COURSES_FILE, filtered);
        return true;
    }
};
const lectures = {
    getAll: ()=>readJSON(LECTURES_FILE),
    getById: (id)=>{
        const all = readJSON(LECTURES_FILE);
        return all.find((l)=>l.id === id);
    },
    getByCourse: (courseId)=>{
        const all = readJSON(LECTURES_FILE);
        return all.filter((l)=>l.courseId === courseId).sort((a, b)=>a.order - b.order);
    },
    create: (lecture)=>{
        const all = readJSON(LECTURES_FILE);
        const newLecture = {
            ...lecture,
            id: generateId(),
            createdAt: new Date().toISOString()
        };
        all.push(newLecture);
        writeJSON(LECTURES_FILE, all);
        return newLecture;
    },
    update: (id, updates)=>{
        const all = readJSON(LECTURES_FILE);
        const index = all.findIndex((l)=>l.id === id);
        if (index === -1) return null;
        all[index] = {
            ...all[index],
            ...updates
        };
        writeJSON(LECTURES_FILE, all);
        return all[index];
    },
    delete: (id)=>{
        const all = readJSON(LECTURES_FILE);
        const filtered = all.filter((l)=>l.id !== id);
        if (filtered.length === all.length) return false;
        writeJSON(LECTURES_FILE, filtered);
        return true;
    }
};
const enrollments = {
    getAll: ()=>readJSON(ENROLLMENTS_FILE),
    getByUser: (userId)=>{
        const all = readJSON(ENROLLMENTS_FILE);
        return all.filter((e)=>e.userId === userId);
    },
    getByCourse: (courseId)=>{
        const all = readJSON(ENROLLMENTS_FILE);
        return all.filter((e)=>e.courseId === courseId);
    },
    get: (userId, courseId)=>{
        const all = readJSON(ENROLLMENTS_FILE);
        return all.find((e)=>e.userId === userId && e.courseId === courseId);
    },
    enroll: (userId, courseId)=>{
        const all = readJSON(ENROLLMENTS_FILE);
        const existing = all.find((e)=>e.userId === userId && e.courseId === courseId);
        if (existing) return existing;
        const newEnrollment = {
            id: generateId(),
            userId,
            courseId,
            progress: 0,
            completedLectures: [],
            enrolledAt: new Date().toISOString()
        };
        all.push(newEnrollment);
        writeJSON(ENROLLMENTS_FILE, all);
        return newEnrollment;
    },
    updateProgress: (userId, courseId, lectureId)=>{
        const all = readJSON(ENROLLMENTS_FILE);
        const index = all.findIndex((e)=>e.userId === userId && e.courseId === courseId);
        if (index === -1) return null;
        if (!all[index].completedLectures.includes(lectureId)) {
            all[index].completedLectures.push(lectureId);
        }
        // Calculate progress
        const courseLectures = lectures.getByCourse(courseId);
        all[index].progress = Math.round(all[index].completedLectures.length / courseLectures.length * 100);
        writeJSON(ENROLLMENTS_FILE, all);
        return all[index];
    },
    unenroll: (userId, courseId)=>{
        const all = readJSON(ENROLLMENTS_FILE);
        const filtered = all.filter((e)=>!(e.userId === userId && e.courseId === courseId));
        if (filtered.length === all.length) return false;
        writeJSON(ENROLLMENTS_FILE, filtered);
        return true;
    }
};
const attendance = {
    getAll: ()=>readJSON(ATTENDANCE_FILE),
    getByCourse: (courseId)=>{
        const all = readJSON(ATTENDANCE_FILE);
        return all.filter((a)=>a.courseId === courseId).sort((a, b)=>new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    getByDate: (courseId, date)=>{
        const all = readJSON(ATTENDANCE_FILE);
        return all.find((a)=>a.courseId === courseId && a.date === date);
    },
    mark: (courseId, date, records, markedBy)=>{
        const all = readJSON(ATTENDANCE_FILE);
        const existingIndex = all.findIndex((a)=>a.courseId === courseId && a.date === date);
        if (existingIndex !== -1) {
            all[existingIndex].records = records;
            all[existingIndex].markedBy = markedBy;
            writeJSON(ATTENDANCE_FILE, all);
            return all[existingIndex];
        }
        const newRecord = {
            id: generateId(),
            courseId,
            date,
            records,
            markedBy,
            createdAt: new Date().toISOString()
        };
        all.push(newRecord);
        writeJSON(ATTENDANCE_FILE, all);
        return newRecord;
    },
    getStudentAttendance: (courseId, studentId)=>{
        const records = readJSON(ATTENDANCE_FILE).filter((a)=>a.courseId === courseId);
        let present = 0;
        let total = 0;
        records.forEach((r)=>{
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
            percentage: total > 0 ? Math.round(present / total * 100) : 0
        };
    }
};
const invites = {
    getAll: ()=>readJSON(INVITES_FILE),
    getByToken: (token)=>{
        const all = readJSON(INVITES_FILE);
        return all.find((i)=>i.token === token);
    },
    create: (role, createdBy)=>{
        const all = readJSON(INVITES_FILE);
        const token = generateId() + generateId();
        const now = new Date();
        const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const invite = {
            token,
            role,
            createdBy,
            createdAt: now.toISOString(),
            expiresAt: expires.toISOString()
        };
        all.push(invite);
        writeJSON(INVITES_FILE, all);
        return invite;
    },
    consume: (token)=>{
        const all = readJSON(INVITES_FILE);
        const index = all.findIndex((i)=>i.token === token);
        if (index === -1) return null;
        const [invite] = all.splice(index, 1);
        writeJSON(INVITES_FILE, all);
        return invite;
    },
    delete: (token)=>{
        const all = readJSON(INVITES_FILE);
        const filtered = all.filter((i)=>i.token !== token);
        if (filtered.length === all.length) return false;
        writeJSON(INVITES_FILE, filtered);
        return true;
    },
    isValid: (token)=>{
        const invite = readJSON(INVITES_FILE).find((i)=>i.token === token);
        if (!invite) return null;
        if (new Date(invite.expiresAt) < new Date()) return null;
        return invite;
    }
};
const __TURBOPACK__default__export__ = {
    users,
    courses,
    lectures,
    enrollments,
    attendance,
    invites
};
}),
"[project]/src/app/api/enrollments/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DELETE",
    ()=>DELETE,
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
;
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const courseId = searchParams.get('courseId');
        if (courseId) {
            // Get all students enrolled in a course
            const courseEnrollments = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["enrollments"].getByCourse(courseId);
            const enriched = courseEnrollments.map((e)=>{
                const user = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["users"].getById(e.userId);
                return {
                    ...e,
                    userId: e.userId,
                    userName: user?.name || 'Unknown',
                    userEmail: user?.email || '',
                    userMacAddress: user?.macAddress ?? null
                };
            });
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                enrollments: enriched
            });
        }
        if (userId) {
            // Get all courses a user is enrolled in
            const userEnrollments = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["enrollments"].getByUser(userId);
            const enriched = userEnrollments.map((e)=>{
                const course = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["courses"].getById(e.courseId);
                const courseLectures = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["lectures"].getByCourse(e.courseId);
                return {
                    ...e,
                    course: course ? {
                        ...course,
                        lectureCount: courseLectures.length
                    } : null
                };
            });
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                enrollments: enriched
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'userId or courseId required'
        }, {
            status: 400
        });
    } catch (error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to fetch enrollments'
        }, {
            status: 500
        });
    }
}
async function POST(request) {
    try {
        const { userId, courseId } = await request.json();
        if (!userId || !courseId) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'userId and courseId are required'
            }, {
                status: 400
            });
        }
        const enrollment = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["enrollments"].enroll(userId, courseId);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            enrollment
        });
    } catch (error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to enroll'
        }, {
            status: 500
        });
    }
}
async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const courseId = searchParams.get('courseId');
        if (!userId || !courseId) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'userId and courseId are required'
            }, {
                status: 400
            });
        }
        const success = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["enrollments"].unenroll(userId, courseId);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success
        });
    } catch (error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to unenroll'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__882a90fe._.js.map