'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Chrome's experimental Shape Detection API — available natively in Chrome/Edge
declare global {
  interface Window {
    FaceDetector?: new (opts?: { maxDetectedFaces?: number; fastMode?: boolean }) => {
      detect(src: HTMLVideoElement | HTMLCanvasElement): Promise<{ boundingBox: DOMRectReadOnly }[]>;
    };
  }
}

type CamStatus  = 'idle' | 'requesting' | 'denied' | 'active' | 'error';
type FaceStatus = 'unknown' | 'present' | 'absent';

interface Props {
  active: boolean;
  checkIntervalMs: number;        // ms between checks (from attendance policy)
  onFaceAbsent?: () => void;      // fired after consecutiveThreshold absent checks
  onFacePresent?: () => void;     // fired on each present check
  consecutiveThreshold?: number;  // absent checks before alerting (default 2)
}

export default function WebcamAttentionMonitor({
  active,
  checkIntervalMs,
  onFaceAbsent,
  onFacePresent,
  consecutiveThreshold = 2,
}: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const absentRef   = useRef(0);

  const [camStatus,    setCamStatus]    = useState<CamStatus>('idle');
  const [faceStatus,   setFaceStatus]   = useState<FaceStatus>('unknown');
  const [minimized,    setMinimized]    = useState(false);
  const [hasDetector,  setHasDetector]  = useState(false);

  // Start camera when active
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    setCamStatus('requesting');

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamStatus('active');
        setHasDetector('FaceDetector' in window);
      })
      .catch(err => {
        if (!cancelled) setCamStatus(err.name === 'NotAllowedError' ? 'denied' : 'error');
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setCamStatus('idle');
      setFaceStatus('unknown');
    };
  }, [active]);

  // Periodic face detection (Chrome's FaceDetector API)
  useEffect(() => {
    if (camStatus !== 'active' || !hasDetector || !window.FaceDetector) return;

    // Check 4× per interval, between 5 s and 30 s
    const CHECK_MS = Math.min(Math.max(checkIntervalMs / 4, 5_000), 30_000);
    const detector = new window.FaceDetector({ maxDetectedFaces: 1, fastMode: true });

    const run = async () => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      try {
        const faces = await detector.detect(v);
        if (faces.length > 0) {
          absentRef.current = 0;
          setFaceStatus('present');
          onFacePresent?.();
        } else {
          absentRef.current++;
          setFaceStatus('absent');
          if (absentRef.current >= consecutiveThreshold) {
            absentRef.current = 0;
            onFaceAbsent?.();
          }
        }
      } catch { /* detection errors are transient — ignore */ }
    };

    intervalRef.current = setInterval(run, CHECK_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [camStatus, hasDetector, checkIntervalMs, onFaceAbsent, onFacePresent, consecutiveThreshold]);

  if (!active) return null;

  const dotColor =
    camStatus !== 'active'    ? 'bg-yellow-400 animate-pulse' :
    faceStatus === 'present'  ? 'bg-emerald-400' :
    faceStatus === 'absent'   ? 'bg-red-400 animate-pulse' :
    'bg-white/40';

  const label =
    camStatus === 'requesting' ? 'Starting…'     :
    camStatus === 'denied'     ? 'Cam denied'    :
    camStatus === 'error'      ? 'Cam error'     :
    !hasDetector               ? 'Camera on'     :
    faceStatus === 'present'   ? 'Attending ✓'   :
    faceStatus === 'absent'    ? 'Look here!'    :
    'Monitoring…';

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {minimized ? (
        <button
          onClick={() => setMinimized(false)}
          title={label}
          className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg border border-white/20 transition ${
            faceStatus === 'absent' ? 'bg-red-500/80' : 'bg-black/60'
          }`}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        </button>
      ) : (
        <div className="glass rounded-xl overflow-hidden shadow-xl border border-white/15 w-36">
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1 bg-black/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
              <span className="text-[10px] text-white/60 truncate">{label}</span>
            </div>
            <button
              onClick={() => setMinimized(true)}
              className="text-white/30 hover:text-white text-xs ml-1 shrink-0"
            >—</button>
          </div>

          {/* Camera feed or error */}
          {camStatus === 'denied' || camStatus === 'error' ? (
            <div className="h-16 bg-black/40 flex items-center justify-center text-[10px] text-white/30 text-center px-2 leading-tight">
              {camStatus === 'denied' ? 'Allow camera\nin browser' : 'Camera\nunavailable'}
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full block bg-black"
              style={{ aspectRatio: '4/3', transform: 'scaleX(-1)' }}
            />
          )}

          {/* Footer note when browser lacks FaceDetector */}
          {camStatus === 'active' && !hasDetector && (
            <div className="px-2 py-0.5 bg-black/30 text-[9px] text-white/25 text-center">
              Use Chrome for auto-detect
            </div>
          )}
        </div>
      )}
    </div>
  );
}
