'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { user } = await auth.login(email, password);
      // Store user in localStorage
      localStorage.setItem('user', JSON.stringify(user));
      router.push(`/dashboard/${user.role}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const demoCredentials = {
    student: { email: 'student@gyan.com', password: 'student123' },
    teacher: { email: 'teacher@gyan.com', password: 'teacher123' },
    admin: { email: 'admin@gyan.com', password: 'admin123' },
  };

  const fillDemoCredentials = (role: string) => {
    const creds = demoCredentials[role as keyof typeof demoCredentials];
    if (creds) {
      setEmail(creds.email);
      setPassword(creds.password);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <span className="text-3xl">📚</span>
          <span className="text-2xl font-bold gradient-text">GyanBrige</span>
        </Link>

        {/* Login Card */}
        <div className="glass rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Welcome Back</h1>
            <p className="text-white/60">Sign in to continue learning</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm text-white/70 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-glass"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-glass"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-4 text-lg disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/forgot-password" className="text-emerald-400 hover:text-emerald-300 text-sm">
              Forgot password?
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-white/60 text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-emerald-400 hover:text-emerald-300">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Credentials */}
        <div className="glass rounded-2xl p-6 mt-6">
          <h3 className="text-sm font-semibold text-white/70 mb-4">🔑 Demo Credentials</h3>
          <div className="grid grid-cols-3 gap-2">
            {['student', 'teacher', 'admin'].map((role) => (
              <button
                key={role}
                onClick={() => fillDemoCredentials(role)}
                className="glass glass-hover p-3 rounded-lg text-center"
              >
                <div className="text-lg mb-1">
                  {role === 'student' ? '🎓' : role === 'teacher' ? '👨‍🏫' : '⚙️'}
                </div>
                <div className="text-xs text-white/70 capitalize">{role}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
