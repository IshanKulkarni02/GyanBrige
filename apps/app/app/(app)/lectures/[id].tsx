import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router, Link } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { api, apiUrl, tokenStore } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-store';
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const c = useColors();

  const me = useAuth((s) => s.me);
  const roles = me?.roles.map((r) => r.role) ?? [];
  const isTeacherOrAdmin = roles.includes('ADMIN') || roles.includes('STAFF') || roles.includes('TEACHER');

  const load = async () => {
    if (!id) return;
    setLec(await api<Lecture>(`/api/lectures/${id}`));
  };

  useEffect(() => { void load(); }, [id]);

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

  const pickAndUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['video/*', 'video/mp4', 'video/webm', 'video/quicktime'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const ext = asset.name.split('.').pop()?.toLowerCase() ?? 'mp4';
    const mime = asset.mimeType ?? `video/${ext}`;

    setBusy('upload');
    setUploadProgress(0);
    try {
      const token = await tokenStore.get();
      const body = new FormData();
      body.append('file', { uri: asset.uri, name: asset.name, type: mime } as never);

      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            try { reject(new Error(JSON.parse(xhr.responseText)?.message ?? `HTTP ${xhr.status}`)); }
            catch { reject(new Error(`HTTP ${xhr.status}`)); }
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', `${apiUrl}/api/lectures/${lec.id}/upload`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(body);
      });

      Alert.alert('Uploaded', 'Video uploaded successfully.');
      await load();
    } catch (e) {
      Alert.alert('Upload failed', (e as Error).message);
    } finally {
      setBusy(null);
      setUploadProgress(null);
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

        {/* Upload pre-recorded video (teacher/admin only) */}
        {isTeacherOrAdmin && (
          <Surface>
            <Text style={{ ...typography.micro, color: c.accent }}>Video</Text>
            <Text style={{ ...typography.h3, color: c.text, marginTop: spacing.xs }}>
              {lec.recordingUrl ? 'Replace recording' : 'Upload recording'}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              Accepted: MP4, WebM, MOV, MKV · Max 500 MB
            </Text>
            {uploadProgress !== null && (
              <View style={{ marginTop: spacing.sm }}>
                <View style={{ height: 6, backgroundColor: c.border, borderRadius: 3 }}>
                  <View style={{ height: 6, width: `${uploadProgress}%`, backgroundColor: c.primary, borderRadius: 3 }} />
                </View>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                  {uploadProgress}%
                </Text>
              </View>
            )}
            <View style={{ marginTop: spacing.md }}>
              <Button
                label={busy === 'upload' ? `Uploading ${uploadProgress ?? 0}%…` : 'Choose video file'}
                busy={busy === 'upload'}
                onPress={pickAndUpload}
              />
            </View>
          </Surface>
        )}

        {/* Live session controls (teacher/admin only) */}
        {isTeacherOrAdmin && (
          <Surface>
            <Text style={{ ...typography.micro, color: c.accent }}>Live</Text>
            <Text style={{ ...typography.h3, color: c.text, marginTop: spacing.xs }}>
              {isLive ? 'Session in progress' : 'Go live'}
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
        )}

        {/* Join live as viewer */}
        {isLive && !isTeacherOrAdmin && (
          <Surface>
            <Text style={{ ...typography.micro, color: c.danger }}>● LIVE NOW</Text>
            <Text style={{ ...typography.h3, color: c.text, marginTop: spacing.xs }}>This lecture is live</Text>
            <View style={{ marginTop: spacing.md }}>
              <Button
                label="Join stream"
                onPress={() => router.push(`/(app)/lectures/${lec.id}/live?role=student`)}
              />
            </View>
          </Surface>
        )}

        {/* Recording tools (once video exists) */}
        {lec.recordingUrl && isTeacherOrAdmin && (
          <Surface>
            <Text style={{ ...typography.micro, color: c.accent }}>Recording tools</Text>
            <Text style={{ ...typography.h3, color: c.text, marginTop: spacing.xs }}>AI processing</Text>
            <Text style={{ color: c.textMuted, marginTop: spacing.xs, fontSize: 12 }}>
              Uses local AI + ffmpeg — fully offline.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                label="Detect chapters"
                variant="secondary"
                busy={busy === 'chap'}
                onPress={() =>
                  wrap('chap', () => api(`/api/lectures/${lec.id}/detect-chapters`, { method: 'POST' }).then(() => undefined), 'Chapters detected')
                }
              />
              <Button
                label="Auto-edit (cut silence)"
                variant="secondary"
                busy={busy === 'edit'}
                onPress={() =>
                  wrap('edit', () =>
                    api<{ originalDuration: number; editedDuration: number; cutCount: number }>(
                      `/api/lectures/${lec.id}/auto-edit`, { method: 'POST' },
                    ).then((r) => Alert.alert('Edited', `Trimmed ${Math.round(r.originalDuration - r.editedDuration)}s across ${r.cutCount} cuts`)),
                  )
                }
              />
              <Link href={`/(app)/notes/${lec.id}`} asChild>
                <Button label="View notes" variant="ghost" />
              </Link>
            </View>
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: spacing.sm }}>
              {lec.recordingUrl}
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
