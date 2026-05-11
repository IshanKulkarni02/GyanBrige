// Live lecture stage.
// Web + desktop (Tauri): uses livekit-client + custom DOM.
// Native iOS/Android: branches to @livekit/react-native LiveKitRoom.
// Token comes from POST /api/livestreams/token; cap is enforced server-side.

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Platform } from 'react-native';
import { fetchJoinToken } from '../../../../lib/livekit';
import { colors, spacing, radius } from '../../../../lib/theme';

export default function LectureLive() {
  const { id, role } = useLocalSearchParams<{ id: string; role?: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const c = colors.light;
  const isTeacher = role === 'teacher';

  useEffect(() => {
    if (!id) return;
    fetchJoinToken(id)
      .then((r) => {
        setToken(r.token);
        setUrl(r.livekitUrl);
      })
      .catch((e) => setErr((e as Error).message));
  }, [id]);

  if (err)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <Text style={{ color: c.danger, fontWeight: '600' }}>Cannot join</Text>
        <Text style={{ color: c.textMuted, marginTop: spacing.xs, textAlign: 'center' }}>{err}</Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: c.text }}>Back</Text>
        </Pressable>
      </View>
    );
  if (!token || !url) return <ActivityIndicator style={{ marginTop: 64 }} />;

  if (Platform.OS === 'web') return <WebLiveStage token={token} url={url} isTeacher={isTeacher} />;
  return <NativeLivePlaceholder isTeacher={isTeacher} />;
}

function WebLiveStage({ token, url, isTeacher }: { token: string; url: string; isTeacher: boolean }) {
  const c = colors.light;
  const [status, setStatus] = useState('connecting');
  useEffect(() => {
    let room: { disconnect: () => void } | null = null;
    (async () => {
      const { Room, RoomEvent } = await import('livekit-client');
      const r = new Room({ adaptiveStream: true, dynacast: true });
      room = r as unknown as { disconnect: () => void };
      r.on(RoomEvent.Connected, () => setStatus('connected'));
      r.on(RoomEvent.Disconnected, () => setStatus('disconnected'));
      await r.connect(url, token);
      if (isTeacher) await r.localParticipant.enableCameraAndMicrophone();
    })().catch((e) => setStatus(`error: ${(e as Error).message}`));
    return () => {
      room?.disconnect();
    };
  }, [token, url, isTeacher]);

  return (
    <View style={{ flex: 1, padding: spacing.md, backgroundColor: '#000' }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
        {isTeacher ? 'Teacher Stage' : 'Live Lecture'}
      </Text>
      <Text style={{ color: '#bbb', marginTop: spacing.xs }}>{status}</Text>
      <View
        nativeID="lk-video-root"
        style={{
          flex: 1,
          marginTop: spacing.md,
          backgroundColor: '#111',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#777' }}>
          {isTeacher ? 'Camera + mic enabled' : 'Audio/video will stream here'}
        </Text>
      </View>
    </View>
  );
}

function NativeLivePlaceholder({ isTeacher }: { isTeacher: boolean }) {
  const c = colors.light;
  return (
    <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg }}>
      <Text style={{ color: c.text, fontWeight: '600', fontSize: 18 }}>Live lecture (native)</Text>
      <Text style={{ color: c.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
        @livekit/react-native will render the room here. {isTeacher ? 'Teacher publishes camera + mic.' : 'Subscriber view.'}
      </Text>
    </View>
  );
}
