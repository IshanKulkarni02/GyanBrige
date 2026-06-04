// Offline-first cache + mutation queue.
// Reads go to memory first → SQLite/IndexedDB → API → write-through.
// Writes that fail enqueue and replay when network returns.

import { Platform } from 'react-native';
import { api } from './api';

interface QueuedMutation {
  id: string;
  path: string;
  method: string;
  body?: unknown;
  queuedAt: number;
}

const MEM_CACHE = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 60_000;

const STORAGE_KEY = 'gb_mutation_queue';

async function loadQueue(): Promise<QueuedMutation[]> {
  if (Platform.OS === 'web') {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
  }
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
}

async function saveQueue(q: QueuedMutation[]): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
    return;
  }
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export async function cachedGet<T>(path: string): Promise<T> {
  const hit = MEM_CACHE.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  try {
    const value = await api<T>(path);
    MEM_CACHE.set(path, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (hit) return hit.value as T;
    throw err;
  }
}

export async function queuedPost(path: string, body: unknown): Promise<void> {
  try {
    await api(path, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    const q = await loadQueue();
    q.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      path,
      method: 'POST',
      body,
      queuedAt: Date.now(),
    });
    await saveQueue(q);
  }
}

export async function drainQueue(): Promise<{ drained: number; failed: number }> {
  const q = await loadQueue();
  if (q.length === 0) return { drained: 0, failed: 0 };
  const remaining: QueuedMutation[] = [];
  let drained = 0;
  for (const m of q) {
    try {
      await api(m.path, {
        method: m.method,
        body: m.body ? JSON.stringify(m.body) : undefined,
      });
      drained++;
    } catch {
      remaining.push(m);
    }
  }
  await saveQueue(remaining);
  return { drained, failed: remaining.length };
}

export function invalidate(prefix: string): void {
  for (const k of MEM_CACHE.keys()) if (k.startsWith(prefix)) MEM_CACHE.delete(k);
}
