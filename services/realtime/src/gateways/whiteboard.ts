import type { Server } from 'socket.io';

export function registerWhiteboard(io: Server) {
  io.on('connection', (socket) => {
    socket.on('wb:join', (boardId: string) => {
      socket.join(`wb:${boardId}`);
      socket.to(`wb:${boardId}`).emit('wb:peer-joined', { userId: socket.data.userId });
    });

    socket.on('wb:update', (msg: { boardId: string; ydocUpdate: ArrayBuffer }) => {
      socket.to(`wb:${msg.boardId}`).emit('wb:update', msg);
    });

    socket.on('wb:awareness', (msg: { boardId: string; state: unknown }) => {
      socket.to(`wb:${msg.boardId}`).emit('wb:awareness', { userId: socket.data.userId, ...msg });
    });
  });
}
