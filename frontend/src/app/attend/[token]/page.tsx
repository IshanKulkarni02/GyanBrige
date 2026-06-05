'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function QrCheckinPage() {
  const params  = useParams();
  const router  = useRouter();
  const token   = params.token as string;

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'expired' | 'already'>('loading');
  const [msg,    setMsg]    = useState('');
  const [course, setCourse] = useState('');

  useEffect(() => {
    const user = (() => {
      try { return JSON.parse(localStorage.getItem('user') ?? ''); } catch { return null; }
    })();

    if (!user) {
      // Redirect to login, come back after
      router.push(`/login?redirect=/attend/${token}`);
      return;
    }
    if (user.role !== 'student') {
      setStatus('error');
      setMsg('Only students can check in via QR code.');
      return;
    }

    // Find session by QR token, then check in
    fetch(`/api/attendance/qr/${token}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.id,
        'x-user-role': user.role,
      },
      body: JSON.stringify({ studentId: user.id }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error === 'already') {
          setStatus('already');
          setCourse(data.course ?? '');
          setMsg(data.error);
        } else if (data.error) {
          setStatus(data.error === 'expired' ? 'expired' : 'error');
          setMsg(data.error);
        } else {
          setStatus('success');
          setCourse(data.course ?? '');
        }
      })
      .catch(() => { setStatus('error'); setMsg('Network error. Try again.'); });
  }, [token, router]);

  const icons: Record<typeof status, string> = {
    loading: '⏳', success: '✅', error: '❌', expired: '⏰', already: '✅',
  };
  const colors: Record<typeof status, string> = {
    loading: 'text-white/60',
    success: 'text-emerald-400',
    error:   'text-red-400',
    expired: 'text-amber-400',
    already: 'text-blue-400',
  };
  const titles: Record<typeof status, string> = {
    loading: 'Checking in…',
    success: 'Attendance Marked!',
    error:   'Check-in Failed',
    expired: 'QR Code Expired',
    already: 'Already Checked In',
  };
  const subtitles: Record<typeof status, string> = {
    loading: 'Please wait…',
    success: course ? `You are marked present for ${course}` : 'You are marked present',
    error:   msg || 'Something went wrong. Ask your teacher.',
    expired: 'This QR code has expired. Ask your teacher to refresh it.',
    already: course ? `You were already marked present for ${course}` : 'Already checked in',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-10 text-center max-w-sm w-full">
        <div className="text-6xl mb-5">{icons[status]}</div>
        <h1 className={`text-2xl font-bold mb-2 ${colors[status]}`}>{titles[status]}</h1>
        <p className="text-white/60 text-sm mb-6">{subtitles[status]}</p>
        {(status === 'success' || status === 'already') && (
          <a href="/dashboard/student" className="btn-primary px-6 py-2.5 rounded-xl inline-block text-sm">
            Go to Dashboard →
          </a>
        )}
        {status === 'expired' && (
          <p className="text-amber-400/70 text-xs">QR codes expire after 10 minutes for security.</p>
        )}
      </div>
    </div>
  );
}
