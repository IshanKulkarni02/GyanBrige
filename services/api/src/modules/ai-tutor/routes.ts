// AI Personal Tutor — personalized, multi-turn, session-aware.
// Personalization: weak topics (flashcard misses + low quiz scores),
// attendance ratio, quiz score trend, upcoming deadlines.
// Sessions stored in MongoDB per student with full message history.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma, mongo } from '../../db.js';
import { env } from '../../env.js';
import { requireAuth } from '../../lib/role-guard.js';
import { AppError } from '../../plugins/errors.js';
import { retrieve, type RetrievalHit } from '../../lib/rag.js';

interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: { lectureId: string; startSec: number; snippet: string }[];
  ts: Date;
}

interface TutorSession {
  studentId: string;
  courseId: string | null;
  title: string;
  messages: TutorMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface LearningProfile {
  weakTopics: string[];
  attendanceRatio: number;
  quizSlope: number;
  upcomingDeadlines: { title: string; dueAt: Date; type: 'assignment' | 'test' }[];
}

function tutorSessions() {
  return mongo().collection<TutorSession>('tutorSessions');
}

async function getLearningProfile(studentId: string, courseIds: string[]): Promise<LearningProfile> {
  const since = new Date(Date.now() - 56 * 24 * 3600 * 1000);

  const [flashMisses, attempts, attendance, totalLectures, upcoming] = await Promise.all([
    prisma.flashcard.findMany({
      where: {
        lecture: { courseId: { in: courseIds } },
        reviews: { some: { studentId, lastResult: { notIn: ['4', '5'] } } },
      },
      select: { front: true },
      take: 20,
    }),
    prisma.testAttempt.findMany({
      where: { studentId, submittedAt: { gte: since }, test: { courseId: { in: courseIds } } },
      select: { score: true },
      orderBy: { submittedAt: 'asc' },
      take: 10,
    }),
    prisma.attendance.count({ where: { studentId, markedAt: { gte: since } } }),
    prisma.lecture.count({
      where: { scheduledAt: { gte: since, lte: new Date() }, courseId: { in: courseIds } },
    }),
    prisma.assignment.findMany({
      where: { courseId: { in: courseIds }, dueAt: { gte: new Date() } },
      select: { title: true, dueAt: true },
      orderBy: { dueAt: 'asc' },
      take: 5,
    }),
  ]);

  const weakTopics = [...new Set(flashMisses.map((f) => f.front.split(/[.?]/)[0]!.slice(0, 60)))].slice(0, 8);
  const scores = attempts.map((a) => a.score ?? 0);
  const n = scores.length;
  const quizSlope = n < 2 ? 0 : (() => {
    const sumX = (n * (n - 1)) / 2;
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = scores.reduce((s, y, x) => s + x * y, 0);
    const sumX2 = scores.reduce((s, _, x) => s + x * x, 0);
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  })();

  return {
    weakTopics,
    attendanceRatio: totalLectures > 0 ? attendance / totalLectures : 1,
    quizSlope,
    upcomingDeadlines: upcoming.map((u) => ({ title: u.title, dueAt: u.dueAt, type: 'assignment' as const })),
  };
}

function buildSystemPrompt(profile: LearningProfile, studentName: string): string {
  const lines = [
    `You are a dedicated personal academic tutor for ${studentName}, a college student.`,
    `Your goal is to help them understand concepts deeply — use analogies, examples, and step-by-step reasoning.`,
    `Ask follow-up questions to check understanding. Be encouraging and patient.`,
    `Answer in a conversational but academically rigorous way.`,
    '',
  ];
  if (profile.weakTopics.length > 0) {
    lines.push(`⚠ Known weak areas: ${profile.weakTopics.join(', ')}. Pay extra attention to these.`);
  }
  if (profile.attendanceRatio < 0.7) {
    lines.push(`This student's attendance is low (${Math.round(profile.attendanceRatio * 100)}%). Gently encourage them and help fill gaps.`);
  }
  if (profile.quizSlope < -0.5) {
    lines.push(`Quiz scores are declining. Be extra supportive and check for fundamental gaps.`);
  } else if (profile.quizSlope > 0.5) {
    lines.push(`Quiz scores are improving — acknowledge progress and gradually raise the challenge.`);
  }
  if (profile.upcomingDeadlines.length > 0) {
    const next = profile.upcomingDeadlines[0]!;
    const days = Math.ceil((next.dueAt.getTime() - Date.now()) / 86400000);
    lines.push(`Upcoming: "${next.title}" due in ${days} day${days !== 1 ? 's' : ''}. If relevant, help them prioritise.`);
  }
  lines.push('', 'When citing lecture content, reference it as [Lecture · mm:ss]. Be concise unless asked to elaborate.');
  return lines.join('\n');
}

async function callLLM(systemPrompt: string, history: TutorMessage[], question: string, context: RetrievalHit[]): Promise<string> {
  const contextBlock = context.length > 0
    ? `\nRelevant lecture material:\n${context.map((h, i) => `[${i + 1}] (${Math.floor(h.startSec / 60)}:${String(Math.floor(h.startSec % 60)).padStart(2, '0')}) ${h.text}`).join('\n\n')}`
    : '';
  const historyBlock = history.slice(-6).map((m) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`).join('\n');
  const transcript = [systemPrompt, contextBlock, '', historyBlock ? `Conversation so far:\n${historyBlock}\n` : '', `Student: ${question}`, 'Tutor:'].join('\n');

  const res = await fetch(`${env.TRANSCRIPTION_URL}/api/notes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, type: 'summary', outputLanguage: 'en' }),
  });
  if (!res.ok) return 'I had trouble generating a response. Please try again.';
  const data = (await res.json()) as { summary?: string; notes?: string };
  return data.summary ?? data.notes ?? 'No answer generated.';
}

export const registerAiTutor: FastifyPluginAsync = async (app) => {
  app.get('/sessions', async (req) => {
    const me = await requireAuth(req);
    return tutorSessions().find({ studentId: me.id }, { projection: { messages: 0 } }).sort({ updatedAt: -1 }).limit(30).toArray();
  });

  app.get('/sessions/:sessionId', async (req) => {
    const me = await requireAuth(req);
    const { sessionId } = req.params as { sessionId: string };
    const { ObjectId } = await import('mongodb');
    const session = await tutorSessions().findOne({ _id: new ObjectId(sessionId) as never, studentId: me.id });
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Session not found');
    return session;
  });

  app.post('/sessions', async (req) => {
    const me = await requireAuth(req);
    const { courseId, title } = z.object({ courseId: z.string().uuid().optional(), title: z.string().default('New session') }).parse(req.body);
    const now = new Date();
    const result = await tutorSessions().insertOne({ studentId: me.id, courseId: courseId ?? null, title, messages: [], createdAt: now, updatedAt: now });
    return { sessionId: result.insertedId.toString() };
  });

  app.post('/sessions/:sessionId/ask', async (req) => {
    const me = await requireAuth(req);
    const { sessionId } = req.params as { sessionId: string };
    const { question, courseIds: reqCourseIds } = z.object({ question: z.string().min(2), courseIds: z.array(z.string().uuid()).optional() }).parse(req.body);

    const { ObjectId } = await import('mongodb');
    const session = await tutorSessions().findOne({ _id: new ObjectId(sessionId) as never, studentId: me.id });
    if (!session) throw new AppError(404, 'NOT_FOUND', 'Session not found');

    const enrolled = await prisma.enrollment.findMany({ where: { userId: me.id }, select: { courseId: true } });
    const allowedIds = enrolled.map((e) => e.courseId);
    const scopedIds = session.courseId ? [session.courseId] : (reqCourseIds?.filter((c) => allowedIds.includes(c)) ?? allowedIds);
    if (scopedIds.length === 0 && !me.roles.includes(Role.ADMIN)) {
      throw new AppError(403, 'NO_COURSES', 'Enrol in a course before using the tutor');
    }

    const effectiveIds = scopedIds.length > 0 ? scopedIds : allowedIds;
    const [hits, profile] = await Promise.all([retrieve(question, effectiveIds, 5), getLearningProfile(me.id, effectiveIds)]);
    const systemPrompt = buildSystemPrompt(profile, me.name ?? 'Student');
    const answer = await callLLM(systemPrompt, session.messages, question, hits);

    const now = new Date();
    const userMsg: TutorMessage = { role: 'user', content: question, ts: now };
    const assistantMsg: TutorMessage = {
      role: 'assistant', content: answer,
      citations: hits.slice(0, 3).map((h) => ({ lectureId: h.lectureId, startSec: h.startSec, snippet: h.text.slice(0, 200) })),
      ts: now,
    };

    await tutorSessions().updateOne(
      { _id: new ObjectId(sessionId) as never },
      { $push: { messages: { $each: [userMsg, assistantMsg] } as never }, $set: { updatedAt: now } },
    );
    if (session.messages.length === 0) {
      await tutorSessions().updateOne({ _id: new ObjectId(sessionId) as never }, { $set: { title: question.slice(0, 60) } });
    }

    return { answer, citations: assistantMsg.citations, profile: { weakTopics: profile.weakTopics, attendanceRatio: profile.attendanceRatio } };
  });

  // Legacy single-shot (backward compat)
  app.post('/ask', async (req) => {
    const me = await requireAuth(req);
    const body = z.object({ question: z.string().min(2), courseIds: z.array(z.string().uuid()).optional() }).parse(req.body);
    const enrolled = await prisma.enrollment.findMany({ where: { userId: me.id }, select: { courseId: true } });
    const courseIds = body.courseIds ?? enrolled.map((e) => e.courseId);
    if (courseIds.length === 0) throw new AppError(403, 'NO_COURSES', 'Enrol in a course first');
    const hits = await retrieve(body.question, courseIds, 6);
    const profile = await getLearningProfile(me.id, courseIds);
    const answer = await callLLM(buildSystemPrompt(profile, me.name ?? 'Student'), [], body.question, hits);
    return { question: body.question, answer, citations: hits.map((h, i) => ({ n: i + 1, lectureId: h.lectureId, startSec: h.startSec, snippet: h.text.slice(0, 240) })) };
  });

  app.post('/reindex/:lectureId', async (req) => {
    await requireAuth(req);
    const { lectureId } = req.params as { lectureId: string };
    const { Queue } = await import('bullmq');
    const { Redis } = await import('ioredis');
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const q = new Queue('embed-transcript', { connection });
    const job = await q.add('reindex', { lectureId });
    return { jobId: job.id };
  });
};
