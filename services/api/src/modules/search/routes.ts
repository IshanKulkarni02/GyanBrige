// Smart search: hybrid pg full-text + pgvector across notes/transcripts/messages.
// ACL-filtered per user (only their enrolled courses, their chat rooms).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma, mongo } from '../../db.js';
import { requireAuth } from '../../lib/role-guard.js';
import { retrieve } from '../../lib/rag.js';

const searchSchema = z.object({
  q: z.string().min(2),
  kinds: z.array(z.enum(['lecture', 'note', 'message', 'assignment'])).optional(),
});

export const registerSearch: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const me = await requireAuth(req);
    const { q, kinds } = searchSchema.parse(req.query);
    const wanted = new Set(kinds ?? ['lecture', 'note', 'message', 'assignment']);

    const enrolled = await prisma.enrollment.findMany({
      where: { userId: me.id },
      select: { courseId: true },
    });
    const courseIds = enrolled.map((e) => e.courseId);

    const out: {
      kind: string;
      id: string;
      title: string;
      snippet: string;
      deeplink: string;
    }[] = [];

    if (wanted.has('lecture') && courseIds.length > 0) {
      const hits = await retrieve(q, courseIds, 5);
      for (const h of hits) {
        out.push({
          kind: 'lecture',
          id: h.lectureId,
          title: `Lecture · ${Math.floor(h.startSec)}s`,
          snippet: h.text.slice(0, 200),
          deeplink: `/(app)/lectures/${h.lectureId}?t=${Math.floor(h.startSec)}`,
        });
      }
    }

    if (wanted.has('assignment') && courseIds.length > 0) {
      const rows = await prisma.assignment.findMany({
        where: {
          courseId: { in: courseIds },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { brief: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, brief: true },
        take: 10,
      });
      for (const a of rows) {
        out.push({
          kind: 'assignment',
          id: a.id,
          title: a.title,
          snippet: a.brief.slice(0, 200),
          deeplink: `/(app)/assignments/${a.id}`,
        });
      }
    }

    if (wanted.has('message')) {
      const db = mongo();
      const rooms = await db
        .collection('chat_rooms')
        .find({ memberIds: me.id }, { projection: { _id: 1 } })
        .toArray();
      const roomIds = rooms.map((r) => r._id);
      const msgs = await db
        .collection('chat_messages')
        .find({ roomId: { $in: roomIds }, body: { $regex: q, $options: 'i' } })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
      for (const m of msgs as Array<{ _id: string; roomId: string; body: string }>) {
        out.push({
          kind: 'message',
          id: m._id,
          title: 'Chat message',
          snippet: m.body.slice(0, 200),
          deeplink: `/(app)/chat/${m.roomId}`,
        });
      }
    }

    return { query: q, results: out };
  });
};
