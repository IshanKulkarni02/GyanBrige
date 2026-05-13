import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router, Link } from 'expo-router';
import { api } from '../../../lib/api';
import { startLiveRoom, startRecording, stopRecording } from '../../../lib/livekit';
import { useColors, spacing, typography } from '../../../lib/theme';
import { Hero, Surface, Button, Tag } from '../../../components/ui';

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
  notes: {
    contentJson: { chapters?: { startSec: number; title: string }[] };
  } | null;
}

export default function LectureDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lec, setLec] = useState<Lecture | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const c = useColors();

  const load = async () => {
    if (!id) return;
    setLec(await api<Lecture>(`/api/lectures/${id}`));
  };
  useEffect(() => {
    void load();
  }, [id]);

  if (!lec) return <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />;
  const isLive = !!lec.liveSession && !lec.liveSession.endedAt;
  const chapters = lec.notes?.contentJson.chapters ?? [];

  const wrap = async (key: string, fn: () => Promise<void>, okMsg?: string) => {
    setBusy(key);
    try {
      await fn();
      if (okMsg) Alert.alert(okMsg);
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero
        eyebrow={lec.course.subject.code}
        title={lec.title}
        subtitle={`${new Date(lec.scheduledAt).toLocaleString()} · ${lec.mode}${isLive ? ' · LIVE' : ''}`}
        right={isLive ? <Tag label="● LIVE" tone="danger" /> : <Tag label={lec.mode} />}
      />

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Surface>
          <Text style={{ ...typography.micro, color: c.accent }}>Live</Text>
          <Text style={{ ...typography.h3, color: c.text, marginTop: spacing.xs }}>
            {isLive ? 'Session in progress' : 'Schedule + go live'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
            {!isLive ? (
              <Button
                label="Start live session"
                busy={busy === 'live'}
                onPress={() =>
                  wrap('live', async () => {
                    await startLiveRoom(lec.id);
                    router.push(`/(app)/lectures/${lec.id}/live?role=teacher`);
                  })
                }
              />
            ) : (
              <>
                <Button
                  label="Open stage"
                  onPress={() => router.push(`/(app)/lectures/${lec.id}/live?role=teacher`)}
                />
                {lec.liveSession?.recordingStatus === 'RECORDING' ? (
                  <Button
                    label="Stop recording"
                    variant="danger"
                    busy={busy === 'rec'}
                    onPress={() => wrap('rec', () => stopRecording(lec.id).then(() => undefined))}
                  />
                ) : (
                  <Button
                    label="Start recording"
                    variant="ghost"
                    busy={busy === 'rec'}
                    onPress={() => wrap('rec', () => startRecording(lec.id).then(() => undefined))}
                  />
                )}
              </>
            )}
          </View>
        </Surface>

        {lec.recordingUrl && (
          <Surface>
            <Text style={{ ...typography.micro, color: c.accent }}>Recording</Text>
            <Text style={{ ...typography.h3, color: c.text, marginTop: spacing.xs }}>Tools</Text>
            <Text style={{ color: c.textMuted, marginTop: spacing.xs, fontSize: 12 }}>
              Uses local AI + ffmpeg for fully offline processing.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                label="Detect chapters"
                variant="secondary"
                busy={busy === 'chap'}
                onPress={() =>
                  wrap(
                    'chap',
                    () =>
                      api(`/api/lectures/${lec.id}/detect-chapters`, { method: 'POST' }).then(() => undefined),
                    'Chapters detected',
                  )
                }
              />
              <Button
                label="Auto-edit (cut silence + filler)"
                variant="secondary"
                busy={busy === 'edit'}
                onPress={() =>
                  wrap(
                    'edit',
                    () =>
                      api<{ originalDuration: number; editedDuration: number; cutCount: number }>(
                        `/api/lectures/${lec.id}/auto-edit`,
                        { method: 'POST' },
                      ).then((r) => {
                        Alert.alert(
                          'Edited',
                          `Trimmed ${Math.round(r.originalDuration - r.editedDuration)}s across ${r.cutCount} cuts`,
                        );
                      }),
                  )
                }
              />
              <Link href={`/(app)/notes/${lec.id}`} asChild>
                <Button label="View notes" variant="ghost" />
              </Link>
            </View>
            <Text style={{ color: c.textSubtle, fontSize: 11, marginTop: spacing.sm }}>
              File: {lec.recordingUrl}
            </Text>
          </Surface>
        )}

        {chapters.length > 0 && (
          <Surface>
            <Text style={{ ...typography.micro, color: c.accent }}>Chapters</Text>
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              {chapters.map((ch, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Text style={{ color: c.accent, fontWeight: '700', width: 64 }}>
                    {Math.floor(ch.startSec / 60)}:{String(Math.floor(ch.startSec % 60)).padStart(2, '0')}
                  </Text>
                  <Text style={{ color: c.text, flex: 1 }}>{ch.title}</Text>
                </View>
              ))}
            </View>
          </Surface>
        )}
      </View>
    </ScrollView>
  );
}
