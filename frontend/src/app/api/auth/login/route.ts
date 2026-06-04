import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { users } from '@/lib/db';
import { logRoute } from '@/lib/logger';

export const POST = logRoute(async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = users.getByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Support legacy plaintext passwords (seed accounts) by upgrading on first login
    let valid = false;
    if (user.password.startsWith('$2')) {
      // Already hashed
      valid = await bcrypt.compare(password, user.password);
    } else {
      // Plaintext (seed / migrated) — compare and upgrade
      valid = user.password === password;
      if (valid) {
        const hashed = await bcrypt.hash(password, 10);
        users.update(user.id, { password: hashed });
      }
    }

    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const { password: _, ...safeUser } = user;
    return NextResponse.json({ success: true, user: safeUser });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
);
