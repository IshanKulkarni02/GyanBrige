import type { Server } from 'socket.io';
import type { Db } from 'mongodb';

export function registerPresence(io: Server, db: Db) {
  const presence = db.collection('presence');

  io.on('connection', async (socket) => {
    const userId = socket.data.userId as string;
    await presence.updateOne(
      { userId },
      { $set: { userId, status: 'online', lastSeen: new Date() } },
      { upsert: true },
    );
    socket.broadcast.emit('presence:update', { userId, status: 'online' });

    const heartbeat = setInterval(() => {
      presence.updateOne({ userId }, { $set: { lastSeen: new Date() } }).catch(() => {});
    }, 30_000);

    socket.on('disconnect', async () => {
      clearInterval(heartbeat);
      await presence.updateOne({ userId }, { $set: { status: 'offline', lastSeen: new Date() } });
      socket.broadcast.emit('presence:update', { userId, status: 'offline' });
    });
  });
}
