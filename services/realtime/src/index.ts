import { createServer } from 'node:http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { MongoClient, type Db } from 'mongodb';
import { env } from './env.js';
import { registerChat } from './gateways/chat.js';
import { registerPresence } from './gateways/presence.js';
import { registerPoll } from './gateways/poll.js';
import { registerWhiteboard } from './gateways/whiteboard.js';
import { registerLiveTelemetry } from './gateways/live-telemetry.js';

interface AuthedSocketData {
  userId: string;
  roles: string[];
}

async function main() {
  const mongoClient = new MongoClient(env.MONGO_URL);
  await mongoClient.connect();
  const db: Db = mongoClient.db();

  const http = createServer();
  const io = new Server<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>, AuthedSocketData>(http, {
    cors: { origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()), credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.replace(/^Bearer\s+/, '');
    if (!token) return next(new Error('UNAUTHENTICATED'));
    try {
      const payload = jwt.verify(token as string, env.JWT_SECRET) as {
        id: string;
        roles: string[];
      };
      socket.data.userId = payload.id;
      socket.data.roles = payload.roles ?? [];
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  registerChat(io, db);
  registerPresence(io, db);
  registerPoll(io, db);
  registerWhiteboard(io);
  registerLiveTelemetry(io);

  http.listen(env.PORT, env.HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`realtime listening on ws://${env.HOST}:${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal', err);
  process.exit(1);
});
