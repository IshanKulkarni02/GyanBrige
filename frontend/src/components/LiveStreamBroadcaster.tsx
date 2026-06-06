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
  const previewRef    = useRef<HTMLVideoElement>(null);
  const roomRef       = useRef<Room | null>(null);
  const recorderRef   = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [status,     setStatus]     = useState<BroadcastStatus>('idle');
  const [error,      setError]      = useState('');
  const [muted,      setMuted]      = useState(false);
  const [camOff,     setCamOff]     = useState(false);
  const [sharing,    setSharing]    = useState(false);
  const [viewers,    setViewers]    = useState(0);
  const [uploadPct,  setUploadPct]  = useState(0);

  // Auth headers read from localStorage (client-only component)
  const authHeaders = useCallback((): Record<string, string> => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string; role?: string };
      return { 'x-user-id': u.id ?? '', 'x-user-role': u.role ?? '' };
    } catch { return {}; }
  }, []);

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

      // 2. Create local tracks ourselves so we can also feed them to MediaRecorder
      const { Room: LKRoom, RoomEvent, Track, createLocalTracks } = await import('livekit-client');
      const room = new LKRoom({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected,    () => setViewers(v => v + 1));
      room.on(RoomEvent.ParticipantDisconnected, () => setViewers(v => Math.max(0, v - 1)));
      room.on(RoomEvent.Disconnected, () => { setStatus('idle'); onStreamEnd?.(); });

      await room.connect(livekitUrl, token);

      const tracks = await createLocalTracks({ audio: true, video: { facingMode: 'user' } });
      for (const t of tracks) await room.localParticipant.publishTrack(t);

      // 3. Wire camera preview
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (camPub?.track && previewRef.current) camPub.track.attach(previewRef.current);

      // 4. Start MediaRecorder on the combined local stream
      const mediaStream = new MediaStream(tracks.map(t => t.mediaStreamTrack));
      localStreamRef.current = mediaStream;

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(mediaStream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(5000); // collect a chunk every 5 s so memory stays bounded

      setStatus('live');
      onStreamStart?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start stream');
      setStatus('error');
    }
  }, [lectureId, userId, authHeaders, onStreamStart, onStreamEnd]);

  const endStream = useCallback(async () => {
    // Stop LiveKit room
    roomRef.current?.disconnect();
    roomRef.current = null;
    await fetch('/api/livestreams/rooms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ lectureId }),
    }).catch(() => {});

    // Stop recorder and wait for final chunk
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

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    try {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      chunksRef.current = [];
      const videoUrl = await uploadRecording(blob, lectureId, authHeaders, setUploadPct);

      // Save videoUrl on the lecture
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
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setMicrophoneEnabled(muted);
    setMuted(m => !m);
  }, [muted]);

  const toggleCam = useCallback(async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setCameraEnabled(camOff);
    setCamOff(c => !c);
  }, [camOff]);

  const toggleScreen = useCallback(async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setScreenShareEnabled(!sharing);
    setSharing(s => !s);
  }, [sharing]);

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
            {status === 'idle'     ? 'Ready'                              :
             status === 'starting' ? 'Starting…'                         :
             status === 'live'     ? `${viewers} viewer${viewers !== 1 ? 's' : ''}` :
             status === 'saving'   ? `Uploading… ${uploadPct}%`          :
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

      {/* Camera preview */}
      <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
        <video
          ref={previewRef}
          autoPlay muted playsInline
          className={`w-full h-full object-cover ${camOff ? 'opacity-0' : ''}`}
          style={{ transform: 'scaleX(-1)' }}
        />
        {status !== 'live' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            {status === 'starting' || status === 'saving'
              ? <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              : <div className="text-center"><span className="text-5xl block mb-2">🎥</span><p className="text-white/40 text-sm">Preview will appear here</p></div>
            }
          </div>
        )}
        {status === 'live' && camOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <span className="text-4xl">📵</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 py-3 flex items-center gap-3">
        {(status === 'idle' || status === 'error') && (
          <button onClick={startStream} className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-2">
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

      {status === 'error' && <p className="px-4 pb-3 text-xs text-red-400">{error}</p>}
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
