import type { Server } from 'socket.io';

export function registerLiveTelemetry(io: Server) {
  io.on('connection', (socket) => {
    socket.on('lecture:join', (lectureId: string) => {
      socket.join(`lecture:${lectureId}`);
      io.to(`lecture:${lectureId}:teachers`).emit('lecture:viewer-joined', {
        userId: socket.data.userId,
      });
    });

    socket.on('lecture:join-teacher', (lectureId: string) => {
      socket.join(`lecture:${lectureId}:teachers`);
    });

    socket.on('lecture:reaction', (msg: { lectureId: string; emoji: string }) => {
      io.to(`lecture:${msg.lectureId}`).emit('lecture:reaction', {
        ...msg,
        userId: socket.data.userId,
        at: new Date(),
      });
    });

    socket.on('disconnect', () => {
      io.emit('lecture:viewer-left', { userId: socket.data.userId });
    });
  });
}
