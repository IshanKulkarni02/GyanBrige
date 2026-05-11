import type { Server } from 'socket.io';
import type { Db } from 'mongodb';
import { ulid } from 'ulid';

export function registerChat(io: Server, db: Db) {
  const messages = db.collection('chat_messages');
  const rooms = db.collection('chat_rooms');

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;

    socket.on('chat:join', async (roomId: string) => {
      const room = await rooms.findOne({ _id: roomId as unknown as never });
      if (!room) return socket.emit('chat:error', { code: 'ROOM_NOT_FOUND' });
      if (Array.isArray(room.memberIds) && !room.memberIds.includes(userId)) {
        return socket.emit('chat:error', { code: 'FORBIDDEN' });
      }
      socket.join(`room:${roomId}`);
      socket.emit('chat:joined', { roomId });
    });

    socket.on('chat:send', async (msg: { roomId: string; kind: string; body?: string; attachments?: unknown[] }) => {
      const doc = {
        _id: ulid(),
        roomId: msg.roomId,
        senderId: userId,
        kind: msg.kind,
        body: msg.body ?? null,
        attachments: msg.attachments ?? [],
        reactions: [],
        edits: [],
        readBy: [{ userId, at: new Date() }],
        createdAt: new Date(),
      };
      await messages.insertOne(doc as never);
      await rooms.updateOne({ _id: msg.roomId as unknown as never }, { $set: { lastMessageAt: doc.createdAt } });
      io.to(`room:${msg.roomId}`).emit('chat:new', doc);
    });

    socket.on('chat:read', async ({ roomId, messageId }: { roomId: string; messageId: string }) => {
      await messages.updateOne(
        { _id: messageId as unknown as never, 'readBy.userId': { $ne: userId } },
        { $push: { readBy: { userId, at: new Date() } as never } },
      );
      io.to(`room:${roomId}`).emit('chat:read', { messageId, userId, at: new Date() });
    });
  });
}
