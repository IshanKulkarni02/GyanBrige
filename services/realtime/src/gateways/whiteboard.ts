import type { Server } from 'socket.io';

interface DrawStroke {
  boardId: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export function registerWhiteboard(io: Server) {
  io.on('connection', (socket) => {
    socket.on('wb:join', (boardId: string) => {
      socket.join(`wb:${boardId}`);
      socket.to(`wb:${boardId}`).emit('wb:peer-joined', { userId: socket.data.userId });
    });

    // Relay completed strokes to all peers in the board room
    socket.on('wb:draw', (msg: DrawStroke) => {
      socket.to(`wb:${msg.boardId}`).emit('wb:draw', msg);
    });

    // Y.js document sync (for future full CRDT integration)
    socket.on('wb:update', (msg: { boardId: string; ydocUpdate: ArrayBuffer }) => {
      socket.to(`wb:${msg.boardId}`).emit('wb:update', msg);
    });

    socket.on('wb:awareness', (msg: { boardId: string; state: unknown }) => {
      socket.to(`wb:${msg.boardId}`).emit('wb:awareness', { userId: socket.data.userId, ...msg });
    });
  });
}
