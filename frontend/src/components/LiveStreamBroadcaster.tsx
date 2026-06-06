'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Room } from 'livekit-client';

interface Props {
  lectureId: string;
  userId: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onRecordingSaved?: (videoUrl: string) => void;
}

type BroadcastStatus = 'idle' | 'starting' | 'live' | 'saving' | 'error';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per upload chunk

export default function LiveStreamBroadcaster({
  lectureId, userId, onStreamStart, onStreamEnd, onRecordingSaved,
}: Props) {
  const previewRef      = useRef<HTMLVideoElement>(null);
  const roomRef         = useRef<Room | null>(null);
  const recorderRef     = useRef<MediaRecorder | null>(null);
  const chunksRef       = useRef<Blob[]>([]);
  const localStreamRef  = useRef<MediaStream | null>(null);

  const [status,     setStatus]     = useState<BroadcastStatus>('idle');
  const [error,      setError]      = useState('');
  const [muted,      setMuted]      = useState(false);
  const [camOff,     setCamOff]     = useState(false);
  const [sharing,    setSharing]    = useState(false);
  const [viewers,    setViewers]    = useState(0);
  const [uploadPct,  setUploadPct]  = useState(0);
  const [camReady,   setCamReady]   = useState(false);
  const [camError,   setCamError]   = useState('');

  const isLivekitError = error.toLowerCase().includes('livekit');

  // Auth headers read from localStorage (client-only component)
  const authHeaders = useCallback((): Record<string, string> => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string; role?: string };
      return { 'x-user-id': u.id ?? '', 'x-user-role': u.role ?? '' };
    } catch { return {}; }
  }, []);

  // ── Start camera preview immediately on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
        setCamReady(true);
      } catch (e) {
        if (!cancelled) {
          setCamError(
            e instanceof DOMException && e.name === 'NotAllowedError'
              ? 'Camera permission denied. Please allow camera access in your browser.'
              : e instanceof DOMException && e.name === 'NotFoundError'
              ? 'No camera found. Please connect a webcam and try again.'
              : 'Could not access camera: ' + (e instanceof Error ? e.message : String(e)),
          );
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Start live stream (LiveKit) ─────────────────────────────────────────────
  const startStream = useCallback(async () => {
    setStatus('starting');
    setError('');
    chunksRef.current = [];

    try {
      // 1. Get room token from server
      const res = await fetch('/api/livestreams/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ lectureId, userId }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to start stream');
      }
      const { token, livekitUrl } = await res.json() as { token: string; livekitUrl: string };

      // 2. Connect LiveKit room using the already-captured local stream tracks
      const { Room: LKRoom, RoomEvent, Track } = await import('livekit-client');
      const room = new LKRoom({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected,    () => setViewers(v => v + 1));
      room.on(RoomEvent.ParticipantDisconnected, () => setViewers(v => Math.max(0, v - 1)));
      room.on(RoomEvent.Disconnected, () => { setStatus('idle'); onStreamEnd?.(); });

      await room.connect(livekitUrl, token);

      // Publish the existing local stream tracks into LiveKit
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (videoTrack) {
          const { LocalVideoTrack } = await import('livekit-client');
          const lkVideo = new LocalVideoTrack(videoTrack, undefined, false);
          await room.localParticipant.publishTrack(lkVideo);
        }
        if (audioTrack) {
          const { LocalAudioTrack } = await import('livekit-client');
          const lkAudio = new LocalAudioTrack(audioTrack);
          await room.localParticipant.publishTrack(lkAudio);
        }
      }

      // 3. Start MediaRecorder on the existing local stream
      const mediaStream = localStreamRef.current ?? new MediaStream();
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(mediaStream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(5000);

      setStatus('live');
      onStreamStart?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start stream');
      setStatus('error');
    }
  }, [lectureId, userId, authHeaders, onStreamStart, onStreamEnd]);

  const endStream = useCallback(async () => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    await fetch('/api/livestreams/rooms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ lectureId }),
    }).catch(() => {});

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setStatus('idle');
      onStreamEnd?.();
      return;
    }

    setStatus('saving');
    setUploadPct(0);

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    try {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];
      const videoUrl = await uploadRecording(blob, lectureId, authHeaders, setUploadPct);
      await fetch(`/api/lectures/${lectureId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ videoUrl }),
      });
      onStreamEnd?.();
      onRecordingSaved?.(videoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setStatus('error');
    }
  }, [lectureId, authHeaders, onStreamEnd, onRecordingSaved]);

  const toggleMic = useCallback(async () => {
    // Toggle local stream audio tracks
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    if (roomRef.current) await roomRef.current.localParticipant.setMicrophoneEnabled(muted);
    setMuted(m => !m);
  }, [muted]);

  const toggleCam = useCallback(async () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOff; });
    if (roomRef.current) await roomRef.current.localParticipant.setCameraEnabled(camOff);
    setCamOff(c => !c);
  }, [camOff]);

  const toggleScreen = useCallback(async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setScreenShareEnabled(!sharing);
    setSharing(s => !s);
  }, [sharing]);

  // Cleanup on unmount
  useEffect(() => () => {
    recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
    roomRef.current?.disconnect();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  return (
    <div className="glass rounded-2xl overflow-hidden border border-white/15">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-3">
          {status === 'live' && (
            <span className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          )}
          {status === 'saving' && (
            <span className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full">
              ⏫ Saving recording…
            </span>
          )}
          <span className="text-sm font-semibold text-white/80">
            {status === 'idle'     ? (camReady ? 'Camera ready' : 'Loading camera…') :
             status === 'starting' ? 'Connecting…'                                   :
             status === 'live'     ? `${viewers} viewer${viewers !== 1 ? 's' : ''}` :
             status === 'saving'   ? `Uploading… ${uploadPct}%`                     :
             'Stream error'}
          </span>
        </div>
        {status === 'live' && (
          <button
            onClick={endStream}
            className="text-xs bg-red-500/20 hover:bg-red-500/40 border border-red-500/40 text-red-400 px-3 py-1.5 rounded-lg transition"
          >
            End &amp; Save
          </button>
        )}
      </div>

      {/* Upload progress bar */}
      {status === 'saving' && (
        <div className="h-1 bg-white/10">
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${uploadPct}%` }} />
        </div>
      )}

      {/* Camera preview — always visible */}
      <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
        <video
          ref={previewRef}
          autoPlay muted playsInline
          className={`w-full h-full object-cover ${camOff ? 'opacity-0' : ''}`}
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Overlay only when camera isn't ready */}
        {!camReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            {camError ? (
              <div className="text-center px-6">
                <span className="text-4xl block mb-3">🚫</span>
                <p className="text-red-400 text-sm font-medium mb-1">Camera blocked</p>
                <p className="text-white/50 text-xs">{camError}</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-white/40 text-sm">Starting camera…</p>
              </div>
            )}
          </div>
        )}

        {/* Cam disabled overlay (while live) */}
        {status === 'live' && camOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <span className="text-4xl">📵</span>
          </div>
        )}

        {/* Starting / saving spinner overlay */}
        {(status === 'starting' || status === 'saving') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 flex items-center gap-3">
        {(status === 'idle' || status === 'error') && (
          <button
            onClick={startStream}
            disabled={!camReady || !!camError}
            className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            🔴 Start Live Stream
          </button>
        )}
        {status === 'live' && (
          <>
            <button onClick={toggleMic} title={muted ? 'Unmute' : 'Mute'}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition ${muted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'border-white/20 text-white/60 hover:bg-white/10'}`}>
              {muted ? '🔇' : '🎤'}
            </button>
            <button onClick={toggleCam} title={camOff ? 'Enable camera' : 'Disable camera'}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition ${camOff ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'border-white/20 text-white/60 hover:bg-white/10'}`}>
              {camOff ? '📵' : '📷'}
            </button>
            <button onClick={toggleScreen} title={sharing ? 'Stop sharing' : 'Share screen'}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition ${sharing ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'border-white/20 text-white/60 hover:bg-white/10'}`}>
              🖥️
            </button>
          </>
        )}
        {status === 'saving' && (
          <div className="flex-1 text-center text-sm text-white/50">
            Please wait — saving your lecture recording…
          </div>
        )}
      </div>

      {/* Error message */}
      {status === 'error' && error && (
        <div className="px-4 pb-4">
          {isLivekitError ? (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-red-400 text-sm font-semibold mb-1">📡 LiveKit not configured</p>
              <p className="text-white/50 text-sm mb-3">
                Live streaming requires a free LiveKit account. It takes 2 minutes to set up.
              </p>
              <ol className="text-white/40 text-xs space-y-1 mb-3 list-decimal list-inside">
                <li>Go to <span className="text-emerald-400">livekit.io</span> → Sign up free</li>
                <li>Create a project → copy the <strong className="text-white/60">URL, API Key, API Secret</strong></li>
                <li>In GyanBrige: <strong className="text-white/60">Admin → AI Settings → LiveKit section</strong></li>
                <li>Paste the credentials and click Save Settings</li>
                <li>Come back here and start your stream 🎉</li>
              </ol>
              <a
                href="/dashboard/admin/ai"
                className="inline-block text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
              >
                Open Admin → AI Settings →
              </a>
            </div>
          ) : (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Chunked upload helper ─────────────────────────────────────────────────────

async function uploadRecording(
  blob: Blob,
  lectureId: string,
  authHeaders: () => Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<string> {
  const uploadId    = `live-${lectureId}-${Date.now()}`;
  const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
  const ext         = 'webm';

  for (let i = 0; i < totalChunks; i++) {
    const slice  = blob.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const fd     = new FormData();
    fd.append('chunk',        new File([slice], `chunk-${i}.${ext}`, { type: blob.type }));
    fd.append('chunkIndex',   String(i));
    fd.append('totalChunks',  String(totalChunks));
    fd.append('uploadId',     uploadId);
    fd.append('originalName', `lecture-${lectureId}.${ext}`);

    const res = await fetch('/api/upload', { method: 'POST', headers: authHeaders(), body: fd });
    if (!res.ok) throw new Error(`Chunk ${i} upload failed`);

    const data = await res.json() as { complete?: boolean; url?: string };
    onProgress(Math.round(((i + 1) / totalChunks) * 100));

    if (data.complete && data.url) return data.url;
  }

  throw new Error('Upload completed but no URL returned');
}
