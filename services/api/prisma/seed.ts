import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';
import pg from 'pg';
import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../../.env')];
for (const p of candidates) { if (fs.existsSync(p)) { loadDotenv({ path: p }); break; } }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const college = await prisma.college.upsert({
    where: { id: 'seed-college' },
    update: {},
    create: {
      id: 'seed-college',
      name: 'GyanBrige Demo College',
      domains: ['demo.gyanbrige.local'],
    },
  });

  const dept = await prisma.department.upsert({
    where: { id: 'seed-dept-cse' },
    update: {},
    create: {
      id: 'seed-dept-cse',
      collegeId: college.id,
      name: 'Computer Science',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@gyanbrige.local' },
    update: {},
    create: {
      email: 'admin@gyanbrige.local',
      name: 'Admin',
      hashedPassword: await argon2.hash('admin1234'),
      roles: { create: { role: Role.ADMIN } },
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@gyanbrige.local' },
    update: {},
    create: {
      email: 'teacher@gyanbrige.local',
      name: 'Teacher One',
      hashedPassword: await argon2.hash('teacher1234'),
      roles: { create: { role: Role.TEACHER, scopeId: dept.id } },
    },
  });

  const subject = await prisma.subject.upsert({
    where: { code: 'CSE101' },
    update: {},
    create: {
      code: 'CSE101',
      name: 'Intro to Computing',
      deptId: dept.id,
      credits: 4,
    },
  });

  const course = await prisma.course.upsert({
    where: { subjectId_semester_year: { subjectId: subject.id, semester: 1, year: 2026 } },
    update: {},
    create: {
      subjectId: subject.id,
      semester: 1,
      year: 2026,
      teachers: { connect: { id: teacher.id } },
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@gyanbrige.local' },
    update: {},
    create: {
      email: 'student@gyanbrige.local',
      name: 'Student One',
      hashedPassword: await argon2.hash('student1234'),
      roles: { create: { role: Role.STUDENT } },
    },
  });

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: course.id } },
    update: {},
    create: { userId: student.id, courseId: course.id },
  });

  // Default new installs to local Ollama for data sovereignty.
  // Admin can flip back to OpenAI via /admin/ai-settings.
  await prisma.aiSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', notesBackend: 'OLLAMA', whisperBackend: 'OLLAMA' },
  });

  console.log('seed complete:');
  console.log('  admin@gyanbrige.local   / admin1234');
  console.log('  teacher@gyanbrige.local / teacher1234');
  console.log('  student@gyanbrige.local / student1234  (enrolled in CSE101)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
