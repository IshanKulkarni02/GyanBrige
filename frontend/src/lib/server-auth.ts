import { NextRequest } from 'next/server';
import { users } from './db';

export function getRequestUser(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role');
  if (!userId || !userRole) return null;
  const user = users.getById(userId);
  if (!user || user.role !== userRole) return null;
  return user;
}

export function requireAuth(request: NextRequest) {
  return getRequestUser(request);
}

export function requireAdmin(request: NextRequest) {
  const user = getRequestUser(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}
