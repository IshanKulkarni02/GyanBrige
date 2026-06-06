'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Room, RemoteTrack, TrackPublication, RemoteParticipant } from 'livekit-client';

// Chrome's native Face Detection API
declare global {
  interface Window {
    FaceDetector?: new (opts?: { maxDetectedFaces?: number; fastMode?: boolean }) => {
      detect(src: HTMLVideoElement): Promise<{ boundingBox: DOMRectReadOnly }[]>;
    };
  }
}

interface Props {
  lectureId: string;
  userId: string;
  courseId: string;   // needed to find the active attendance session
}

type ViewStatus = 'idle' | 'fetching' | 'connecting' | 'live' | 'ended' | 'error' | 'no-stream';

/** How often to ask for attention while watching (ms). */
const ATTENTION_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes
/** How long the student has to respond (s). */
const ATTENTION_TIMEOUT_S = 30;

export default function LiveStreamViewer({ lectureId, userId, courseId }: Props) {
  // ── Stream refs ──────────────────────────────────────────────────────────────
  const videoRef  = useRef<HTMLVideoElement>(null);
  const audioRef  = useRef<HTMLAudioElement>(null);
  const roomRef   = useRef<Room | null>(null);

  const [status, setStatus] = useState<ViewStatus>('idle');
  const [error,  setError]  = useState('');

  // ── Attention / attendance state ─────────────────────────────────────────────
  const camRef         = useRef<HTMLVideoElement>(null);      // PIP cam feed
  const camStreamRef   = useRef<MediaStream | null>(null);
  const detectorRef    = useRef<InstanceType<NonNullable<typeof window.FaceDetector>> | null>(null);
  const attIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const markedRef      = useRef(false);  // prevent double-marking per session

  const [camReady,        setCamReady]        = useState(false);
  const [camDenied,       setCamDenied]       = useState(false);
  const [facePresent,     setFacePresent]     = useState<boolean | null>(null);
  const [showPrompt,      setShowPrompt]      = useState(false);
  const [countdown,       setCountdown]       = useState(ATTENTION_TIMEOUT_S);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [pipMinimized,    setPipMinimized]    = useState(false);

  // ── Auth headers ─────────────────────────────────────────────────────────────
  const authHeaders = useCallback((): Record<string, string> => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string; role?: string };
      return { 'x-user-id': u.id ?? '', 'x-user-role': u.role ?? '', 'Content-Type': 'application/json' };
    } catch { return { 'Content-Type': 'application/json' }; }
  }, []);

  // ── Mark attendance via active session checkin ────────────────────────────────
  const markAttendance = useCallback(async () => {
    if (markedRef.current) return;
    try {
      const r = await fetch(`/api/attendance/sessions?courseId=${courseId}`, { headers: authHeaders() });
      const d = await r.json() as { sessions?: { id: string; status: string }[] };
      const active = (d.sessions ?? []).find(s => s.status === 'active');
      if (!active) return;
      await fetch(`/api/attendance/sessions/${active.id}/checkin`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ studentId: userId, method: 'online', status: 'present', proofType: 'attention_check' }),
      });
      markedRef.current = true;
      setAttendanceMarked(true);
    } catch { /* silent — teacher can mark manually */ }
  }, [courseId, userId, authHeaders]);

  // ── Confirm attention (button click or face detected back) ───────────────────
  const confirmAttention = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowPrompt(false);
    setCountdown(ATTENTION_TIMEOUT_S);
    markAttendance();
  }, [markAttendance]);

  // ── Show the attention prompt + start countdown ───────────────────────────────
  const triggerPrompt = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(ATTENTION_TIMEOUT_S);
    setShowPrompt(true);
    let t = ATTENTION_TIMEOUT_S;
    countdownRef.current = setInterval(() => {
      t -= 1;
      setCountdown(t);
      if (t <= 0) {
        clearInterval(countdownRef.current!);
        setShowPrompt(false);
        setCountdown(ATTENTION_TIMEOUT_S);
        // Timed out without response — will try again next interval
      }
    }, 1000);
  }, []);

  // ── Start student camera + face detection ────────────────────────────────────
  const startCam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 160, height: 120 },
        audio: false,
      });
      camStreamRef.current = stream;
      if (camRef.current) camRef.current.srcObject = stream;
      setCamReady(true);

      // Set up Face Detector if available (Chrome/Edge)
      if ('FaceDetector' in window) {
        detectorRef.current = new window.FaceDetector!({ maxDetectedFaces: 1, fastMode: true });
        // Check every 30s
        faceIntervalRef.current = setInterval(async () => {
          if (!camRef.current || !detectorRef.current) return;
          try {
            const faces = await detectorRef.current.detect(camRef.current);
            const present = faces.length > 0;
            setFacePresent(present);
            if (!present) {
              // Face left the frame — trigger attention prompt
              triggerPrompt();
            } else if (present) {
              // Face is back — auto-confirm any open prompt
              setShowPrompt(prev => {
                if (prev) {
                  if (countdownRef.current) clearInterval(countdownRef.current);
                  markAttendance();
                  return false;
                }
                return prev;
              });
            }
          } catch { /* detection error — ignore */ }
        }, 30_000);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotAllowedError') setCamDenied(true);
      // If cam denied, fall back to timer-only prompts
    }
  }, [triggerPrompt, markAttendance]);

  // ── Periodic prompt fallback (runs regardless of face detection) ─────────────
  const startAttentionTimer = useCallback(() => {
    if (attIntervalRef.current) clearInterval(attIntervalRef.current);
    attIntervalRef.current = setInterval(() => {
      // Only trigger if not already showing a prompt
      setShowPrompt(prev => { if (!prev) { triggerPrompt(); } return prev; });
    }, ATTENTION_INTERVAL_MS);
  }, [triggerPrompt]);

  // ── Join LiveKit room ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function join() {
      setStatus('fetching');
      try {
        // Check active room
        const checkRes = await fetch(`/api/livestreams/rooms?lectureId=${lectureId}`);
        const checkData = await checkRes.json() as { room?: { roomName: string } };
        if (!checkData.room) { setStatus('no-stream'); return; }

        // Get viewer token (with auth headers)
        let authH: Record<string, string> = {};
        try {
          const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string; role?: string };
          if (u.id && u.role) authH = { 'x-user-id': u.id, 'x-user-role': u.role };
        } catch { /* ignore */ }

        const tokenRes = await fetch('/api/livestreams/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authH },
          body: JSON.stringify({ lectureId, userId }),
        });
        if (!tokenRes.ok) throw new Error('Could not get stream token');
        const { token, livekitUrl } = await tokenRes.json() as { token: string; livekitUrl: string };

        if (cancelled) return;
        setStatus('connecting');

        const { Room: LKRoom, RoomEvent, Track } = await import('livekit-client');
        const room = new LKRoom({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const attachTrack = (track: RemoteTrack, _pub: TrackPublication, _p: RemoteParticipant) => {
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
          } else if (track.kind === Track.Kind.Audio && audioRef.current) {
            track.attach(audioRef.current);
          }
        };

        room.on(RoomEvent.TrackSubscribed, attachTrack);
        room.on(RoomEvent.Connected, () => {
          if (!cancelled) {
            setStatus('live');
            // Start cam + attention checks once live
            startCam();
            startAttentionTimer();
            // First check after 1 minute to confirm they're watching
            setTimeout(() => markAttendance(), 60_000);
          }
        });
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) setStatus('ended');
        });

        await room.connect(livekitUrl, token);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Connection failed');
          setStatus('error');
        }
      }
    }

    void join();

    return () => {
      cancelled = true;
      roomRef.current?.disconnect();
      roomRef.current = null;
      if (attIntervalRef.current)  clearInterval(attIntervalRef.current);
      if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
      if (countdownRef.current)    clearInterval(countdownRef.current);
      camStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [lectureId, userId, startCam, startAttentionTimer, markAttendance]);

  if (status === 'no-stream') return null;

  return (
    <div className="w-full rounded-xl overflow-hidden glass border border-white/10">

      {/* Attention check overlay */}
      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="glass rounded-2xl p-8 text-center max-w-sm w-full border border-white/15">
            <div className="text-5xl mb-3">{facePresent === false ? '👀' : '👁️'}</div>
            <h2 className="text-xl font-bold mb-2">Are you watching?</h2>
            <p className="text-white/55 text-sm mb-4">
              {facePresent === false
                ? "We couldn't detect your face. Look at the screen and confirm you're here."
                : 'Confirm your presence to mark attendance.'}
            </p>
            <div className="text-3xl font-mono text-amber-400 mb-4">{countdown}s</div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${(countdown / ATTENTION_TIMEOUT_S) * 100}%` }}
              />
            </div>
            <button onClick={confirmAttention} className="btn-primary w-full py-3 text-base">
              ✓ Yes, I&apos;m here
            </button>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-red-500 animate-pulse' : 'bg-white/30'}`} />
          <span className="text-xs font-medium text-white/70">
            {status === 'fetching'   ? 'Checking for live stream…' :
             status === 'connecting' ? 'Connecting…'               :
             status === 'live'       ? 'LIVE'                      :
             status === 'ended'      ? 'Stream ended'              :
             status === 'error'      ? `Error: ${error}`           : ''}
          </span>
        </div>
        {status === 'live' && (
          <div className="flex items-center gap-2">
            {attendanceMarked && (
              <span className="text-xs text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                ✓ Present
              </span>
            )}
            {camReady && !camDenied && (
              <button
                onClick={() => setPipMinimized(m => !m)}
                className="text-xs text-white/40 hover:text-white/70 transition"
                title={pipMinimized ? 'Show camera' : 'Hide camera'}
              >
                {pipMinimized ? '📷' : '🙈'}
              </button>
            )}
            {camDenied && (
              <span className="text-xs text-amber-400/80">⚠ Cam blocked</span>
            )}
          </div>
        )}
      </div>

      {/* Main video */}
      <div className="relative bg-black w-full" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          autoPlay playsInline
          className={`w-full h-full object-contain ${status === 'live' ? '' : 'hidden'}`}
        />
        <audio ref={audioRef} autoPlay />

        {status !== 'live' && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
            {(status === 'fetching' || status === 'connecting') && (
              <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            )}
            {status === 'ended' && <span className="text-4xl">📺</span>}
            {status === 'error' && <span className="text-4xl">⚠️</span>}
          </div>
        )}

        {/* Student PIP camera (small, bottom-right) */}
        {status === 'live' && camReady && !camDenied && !pipMinimized && (
          <div className="absolute bottom-3 right-3 w-24 h-18 rounded-lg overflow-hidden border border-white/20 shadow-lg bg-black">
            <video
              ref={camRef}
              autoPlay muted playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {/* Face status dot */}
            <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
              facePresent === true  ? 'bg-emerald-400' :
              facePresent === false ? 'bg-red-400 animate-pulse' :
              'bg-white/30'
            }`} />
          </div>
        )}

        {/* Cam permission nudge */}
        {status === 'live' && !camReady && !camDenied && (
          <div className="absolute bottom-3 right-3 glass rounded-lg px-3 py-2 text-xs text-white/60 border border-white/10">
            📷 Allow camera for auto-attendance
          </div>
        )}
      </div>
    </div>
  );
}
