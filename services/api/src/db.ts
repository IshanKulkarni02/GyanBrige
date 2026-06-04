import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { MongoClient, type Db } from 'mongodb';
import { env } from './env.js';
import { logger } from './logger.js';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: env.NODE_ENV === 'production' ? ['error', 'warn'] : ['warn', 'error'],
});

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (mongoDb) return mongoDb;
  mongoClient = new MongoClient(env.MONGO_URL);
  await mongoClient.connect();
  mongoDb = mongoClient.db();
  logger.info('mongo connected');
  return mongoDb;
}

export function mongo(): Db {
  if (!mongoDb) throw new Error('Mongo not connected. Call connectMongo() at boot.');
  return mongoDb;
}

export async function disconnectAll(): Promise<void> {
  await prisma.$disconnect();
  await mongoClient?.close();
}
