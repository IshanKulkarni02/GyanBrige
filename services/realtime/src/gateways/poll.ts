import type { Server } from 'socket.io';
import type { Db } from 'mongodb';
import { ulid } from 'ulid';

export function registerPoll(io: Server, db: Db) {
  const polls = db.collection('live_polls');

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    const roles: string[] = (socket.data.roles as string[]) ?? [];

    socket.on(
      'poll:open',
      async (msg: { lectureId: string; prompt: string; options: string[] }) => {
        try {
          // Only teachers and admins may open polls
          const isTeacher = roles.includes('TEACHER') || roles.includes('ADMIN') || roles.includes('STAFF');
          if (!isTeacher) {
            return socket.emit('poll:error', { code: 'FORBIDDEN', message: 'Only teachers can open polls' });
          }
          if (!msg.prompt?.trim() || !Array.isArray(msg.options) || msg.options.length < 2) {
            return socket.emit('poll:error', { code: 'BAD_DATA', message: 'Need a prompt and at least 2 options' });
          }
          const doc = {
            _id: ulid(),
            lectureId: msg.lectureId,
            createdBy: userId,
            prompt: msg.prompt,
            options: msg.options,
            votes: [],
            openedAt: new Date(),
            closedAt: null,
          };
          await polls.insertOne(doc as never);
          io.to(`lecture:${msg.lectureId}`).emit('poll:opened', doc);
        } catch (e) {
          socket.emit('poll:error', { code: 'OPEN_FAILED', message: (e as Error).message });
        }
      },
    );

    socket.on('poll:vote', async (msg: { pollId: string; optionIndex: number }) => {
      try {
        const poll = await polls.findOne({ _id: msg.pollId as unknown as never });
        if (!poll || poll.closedAt) return;
        // Bounds-check the option index
        if (msg.optionIndex < 0 || msg.optionIndex >= (poll.options as unknown[]).length) {
          return socket.emit('poll:error', { code: 'BAD_OPTION', message: 'Invalid option index' });
        }
        const already = (poll.votes as { userId: string }[]).some((v) => v.userId === userId);
        if (already) return;
        await polls.updateOne(
          { _id: msg.pollId as unknown as never },
          { $push: { votes: { userId, optionIndex: msg.optionIndex, at: new Date() } as never } },
        );
        const tally = new Array((poll.options as unknown[]).length).fill(0) as number[];
        for (const v of poll.votes as { optionIndex: number }[]) tally[v.optionIndex] = (tally[v.optionIndex] ?? 0) + 1;
        tally[msg.optionIndex] = (tally[msg.optionIndex] ?? 0) + 1;
        io.to(`lecture:${poll.lectureId as string}`).emit('poll:tally', { pollId: msg.pollId, tally });
      } catch (e) {
        socket.emit('poll:error', { code: 'VOTE_FAILED', message: (e as Error).message });
      }
    });

    socket.on('poll:lost', (msg: { lectureId: string }) => {
      io.to(`lecture:${msg.lectureId}`).emit('poll:lost-pulse', { at: new Date() });
    });

    socket.on('poll:close', async (msg: { pollId: string }) => {
      try {
        const poll = await polls.findOne({ _id: msg.pollId as unknown as never });
        if (!poll) return;
        // Only the creator or admin can close
        if (poll.createdBy !== userId && !roles.includes('ADMIN') && !roles.includes('STAFF')) {
          return socket.emit('poll:error', { code: 'FORBIDDEN' });
        }
        await polls.updateOne({ _id: msg.pollId as unknown as never }, { $set: { closedAt: new Date() } });
        io.to(`lecture:${poll.lectureId as string}`).emit('poll:closed', { pollId: msg.pollId });
      } catch (e) {
        socket.emit('poll:error', { code: 'CLOSE_FAILED', message: (e as Error).message });
      }
    });
  });
}
