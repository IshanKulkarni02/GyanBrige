'use client';

import { useEffect, useRef, useState } from 'react';
import type { Room, RemoteTrack, RemoteParticipant, TrackPublication } from 'livekit-client';

interface Props {
  lectureId: string;
  userId: string;
}

type ViewStatus = 'idle' | 'fetching' | 'connecting' | 'live' | 'ended' | 'error' | 'no-stream';

export default function LiveStreamViewer({ lectureId, userId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const roomRef      = useRef<Room | null>(null);
  const [status, setStatus] = useState<ViewStatus>('idle');
  const [error,  setError]  = useState('');

  useEffect(() => {
    let cancelled = false;

    async function join() {
      setStatus('fetching');
      try {
        // Check for active room first
        const checkRes = await fetch(`/api/livestreams/rooms?lectureId=${lectureId}`);
        const checkData = await checkRes.json() as { room?: { roomName: string } };
        if (!checkData.room) { setStatus('no-stream'); return; }

        // Get viewer token
        const tokenRes = await fetch('/api/livestreams/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lectureId, userId, role: 'viewer' }),
        });
        if (!tokenRes.ok) throw new Error('Could not get stream token');
        const { token, livekitUrl } = await tokenRes.json() as { token: string; livekitUrl: string };

        if (cancelled) return;
        setStatus('connecting');

        const { Room: LKRoom, RoomEvent, Track } = await import('livekit-client');
        const room = new LKRoom({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const attachTrack = (track: RemoteTrack, publication: TrackPublication, participant: RemoteParticipant) => {
          if (!containerRef.current) return;
          void publication;
          void participant;
          const el = track.kind === Track.Kind.Video
            ? document.createElement('video')
            : document.createElement('audio');
          el.autoplay = true;
          if (el instanceof HTMLVideoElement) {
            el.playsInline = true;
            el.className = 'w-full h-full object-contain';
          }
          track.attach(el);
          containerRef.current.appendChild(el);
        };

        room.on(RoomEvent.TrackSubscribed, attachTrack);
        room.on(RoomEvent.Connected,    () => { if (!cancelled) setStatus('live'); });
        room.on(RoomEvent.Disconnected, () => { if (!cancelled) setStatus('ended'); });

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
      // Remove all media elements
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [lectureId, userId]);

  if (status === 'no-stream') return null;

  return (
    <div className="w-full rounded-xl overflow-hidden glass border border-white/10">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-black/40 border-b border-white/10">
        <div className={`w-2 h-2 rounded-full ${status === 'live' ? 'bg-red-500 animate-pulse' : 'bg-white/30'}`} />
        <span className="text-xs font-medium text-white/70">
          {status === 'fetching'    ? 'Checking for live stream…' :
           status === 'connecting'  ? 'Connecting to live stream…' :
           status === 'live'        ? 'LIVE' :
           status === 'ended'       ? 'Stream ended' :
           status === 'error'       ? `Error: ${error}` : ''}
        </span>
      </div>

      {/* Video container */}
      <div
        ref={containerRef}
        className="relative bg-black w-full flex items-center justify-center"
        style={{ minHeight: 240, aspectRatio: '16/9' }}
      >
        {status !== 'live' && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
            {(status === 'fetching' || status === 'connecting') && (
              <div className="w-8 h-8 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            )}
            {status === 'ended' && <span className="text-4xl">📺</span>}
            {status === 'error' && <span className="text-4xl">⚠️</span>}
          </div>
        )}
      </div>
    </div>
  );
}
