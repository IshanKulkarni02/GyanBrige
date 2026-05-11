import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../../lib/api';
import { startLiveRoom, startRecording, stopRecording } from '../../../lib/livekit';
import { colors, spacing, radius } from '../../../lib/theme';

interface Lecture {
  id: string;
  title: string;
  scheduledAt: string;
  mode: 'IN_PERSON' | 'ONLINE' | 'HYBRID';
  recordingUrl: string | null;
  transcriptionJobId: string | null;
  liveSession: {
    livekitRoom: string;
    startedAt: string | null;
    endedAt: string | null;
    recordingStatus: string;
  } | null;
  course: { id: string; subject: { code: string; name: string }; teachers: { id: string }[] };
}

export default function LectureDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lec, setLec] = useState<Lecture | null>(null);
  const [busy, setBusy] = useState(false);
  const c = colors.light;

  const load = async () => {
    if (!id) return;
    setLec(await api<Lecture>(`/api/lectures/${id}`));
  };
  useEffect(() => {
    void load();
  }, [id]);

  if (!lec) return <ActivityIndicator style={{ marginTop: 32 }} />;
  const isLive = !!lec.liveSession && !lec.liveSession.endedAt;

  const goLive = async () => {
    setBusy(true);
    try {
      await startLiveRoom(lec.id);
      router.push(`/(app)/lectures/${lec.id}/live?role=teacher`);
    } catch (e) {
      Alert.alert('Could not start', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const recOn = async () => {
    setBusy(true);
    try {
      await startRecording(lec.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const recOff = async () => {
    setBusy(true);
    try {
      await stopRecording(lec.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: spacing.lg, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>{lec.title}</Text>
      <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
        {lec.course.subject.code} · {new Date(lec.scheduledAt).toLocaleString()} · {lec.mode}
      </Text>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        {!isLive ? (
          <Pressable
            onPress={goLive}
            disabled={busy}
            style={{
              padding: spacing.md,
              backgroundColor: c.primary,
              borderRadius: radius.md,
              alignItems: 'center',
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Start live session</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => router.push(`/(app)/lectures/${lec.id}/live?role=teacher`)}
              style={{
                padding: spacing.md,
                backgroundColor: c.primary,
                borderRadius: radius.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Open stage</Text>
            </Pressable>
            {lec.liveSession?.recordingStatus === 'RECORDING' ? (
              <Pressable
                onPress={recOff}
                disabled={busy}
                style={{
                  padding: spacing.md,
                  backgroundColor: c.danger,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Stop recording</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={recOn}
                disabled={busy}
                style={{
                  padding: spacing.md,
                  borderColor: c.danger,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.danger, fontWeight: '600' }}>Start recording</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {lec.recordingUrl && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: c.text, fontWeight: '600' }}>Recording ready</Text>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>{lec.recordingUrl}</Text>
          {lec.transcriptionJobId && (
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              Job {lec.transcriptionJobId}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
