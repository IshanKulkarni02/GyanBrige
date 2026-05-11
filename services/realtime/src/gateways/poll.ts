import type { Server } from 'socket.io';
import type { Db } from 'mongodb';
import { ulid } from 'ulid';

export function registerPoll(io: Server, db: Db) {
  const polls = db.collection('live_polls');

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;

    socket.on(
      'poll:open',
      async (msg: { lectureId: string; prompt: string; options: string[] }) => {
        const doc = {
          _id: ulid(),
          lectureId: msg.lectureId,
          prompt: msg.prompt,
          options: msg.options,
          votes: [],
          openedAt: new Date(),
          closedAt: null,
        };
        await polls.insertOne(doc as never);
        io.to(`lecture:${msg.lectureId}`).emit('poll:opened', doc);
      },
    );

    socket.on('poll:vote', async (msg: { pollId: string; optionIndex: number }) => {
      const poll = await polls.findOne({ _id: msg.pollId as unknown as never });
      if (!poll || poll.closedAt) return;
      const already = (poll.votes as { userId: string }[]).some((v) => v.userId === userId);
      if (already) return;
      await polls.updateOne(
        { _id: msg.pollId as unknown as never },
        { $push: { votes: { userId, optionIndex: msg.optionIndex, at: new Date() } as never } },
      );
      const tally = new Array(poll.options.length).fill(0) as number[];
      for (const v of poll.votes as { optionIndex: number }[]) tally[v.optionIndex] = (tally[v.optionIndex] ?? 0) + 1;
      tally[msg.optionIndex] = (tally[msg.optionIndex] ?? 0) + 1;
      io.to(`lecture:${poll.lectureId}`).emit('poll:tally', { pollId: msg.pollId, tally });
    });

    socket.on('poll:lost', (msg: { lectureId: string }) => {
      io.to(`lecture:${msg.lectureId}`).emit('poll:lost-pulse', { at: new Date() });
    });

    socket.on('poll:close', async (msg: { pollId: string }) => {
      await polls.updateOne({ _id: msg.pollId as unknown as never }, { $set: { closedAt: new Date() } });
      io.emit('poll:closed', { pollId: msg.pollId });
    });
  });
}
