import { NextResponse } from 'next/server';
import { users } from '@/lib/db';

// GET all users
export async function GET() {
  try {
    const allUsers = users.getAll().map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      macAddress: u.macAddress ?? null,
    }));
    return NextResponse.json({ users: allUsers });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
