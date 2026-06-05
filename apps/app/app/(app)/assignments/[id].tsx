import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Assignment {
  id: string;
  title: string;
  brief: string;
  dueAt: string;
  maxScore: number;
  submissionTypes: string[];
  course: { subject: { code: string; name: string } };
  submissions: {
    id: string;
    status: string;
    score: number | null;
    contentText: string | null;
    gitRepoUrl: string | null;
    files: { name: string; url: string }[];
    plagiarismScore: number | null;
  }[];
}

interface PickedFile {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
}

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [a, setA] = useState<Assignment | null>(null);
  const [text, setText] = useState('');
  const [git, setGit] = useState('');
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const c = colors.light;

  const load = async () => {
    if (!id) return;
    const res = await api<Assignment>(`/api/assignments/${id}`);
    setA(res);
    const cur = res.submissions[0];
    if (cur) {
      setText(cur.contentText ?? '');
      setGit(cur.gitRepoUrl ?? '');
    }
  };
  useEffect(() => { void load(); }, [id]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      setFiles((prev) => {
        const existing = new Set(prev.map((f) => f.uri));
        const next = result.assets.filter((a) => !existing.has(a.uri));
        return [...prev, ...next];
      });
    } catch {
      Alert.alert('Could not pick file');
    }
  };

  const removeFile = (uri: string) => setFiles((prev) => prev.filter((f) => f.uri !== uri));

  const submit = async () => {
    setBusy(true);
    try {
      // Upload files to MinIO via the API's multipart endpoint, get back URLs
      const uploadedFiles: { name: string; url: string }[] = [];
      for (const f of files) {
        const form = new FormData();
        form.append('file', { uri: f.uri, name: f.name, type: f.mimeType ?? 'application/octet-stream' } as never);
        const { url } = await api<{ url: string }>('/api/uploads/assignment', { method: 'POST', body: form, headers: {} });
        uploadedFiles.push({ name: f.name, url });
      }

      await api(`/api/assignments/${id}/submissions`, {
        method: 'POST',
        body: JSON.stringify({
          contentText: text || undefined,
          gitRepoUrl: git || undefined,
          files: uploadedFiles,
        }),
      });
      Alert.alert('Submitted');
      setFiles([]);
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!a) return <ActivityIndicator style={{ marginTop: 32 }} />;
  const sub = a.submissions[0];
  const wantsFile = a.submissionTypes.includes('FILE');

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>{a.title}</Text>
      <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
        {a.course.subject.code} · due {new Date(a.dueAt).toLocaleString()} · max {a.maxScore}
      </Text>
      <Text style={{ color: c.text, marginTop: spacing.md, lineHeight: 20 }}>{a.brief}</Text>

      {sub && (
        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ color: c.text }}>Status: {sub.status}</Text>
          {sub.score != null && <Text style={{ color: c.text }}>Score: {sub.score} / {a.maxScore}</Text>}
          {sub.files && sub.files.length > 0 && (
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              {sub.files.length} file{sub.files.length !== 1 ? 's' : ''} attached
            </Text>
          )}
          {sub.plagiarismScore != null && (
            <Text style={{ color: sub.plagiarismScore > 0.4 ? c.danger : c.textMuted }}>
              Plagiarism similarity: {(sub.plagiarismScore * 100).toFixed(0)}%
            </Text>
          )}
        </View>
      )}

      {(a.submissionTypes.includes('TEXT') || a.submissionTypes.includes('LONG')) && (
        <>
          <Text style={{ marginTop: spacing.lg, color: c.text, fontWeight: '600' }}>Your answer</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Type or paste your answer..."
            style={{
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              padding: spacing.sm,
              color: c.text,
              minHeight: 200,
              marginTop: spacing.xs,
              textAlignVertical: 'top',
            }}
          />
        </>
      )}

      {a.submissionTypes.includes('GIT') && (
        <>
          <Text style={{ marginTop: spacing.md, color: c.text, fontWeight: '600' }}>Git repo URL</Text>
          <TextInput
            value={git}
            onChangeText={setGit}
            autoCapitalize="none"
            placeholder="https://github.com/you/project"
            style={{
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              padding: spacing.sm,
              color: c.text,
              marginTop: spacing.xs,
            }}
          />
        </>
      )}

      {wantsFile && (
        <>
          <Text style={{ marginTop: spacing.md, color: c.text, fontWeight: '600' }}>Attachments</Text>
          {files.map((f) => (
            <View
              key={f.uri}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: spacing.xs,
                padding: spacing.sm,
                borderRadius: radius.sm,
                backgroundColor: c.surface,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <Text style={{ color: c.text, flex: 1 }} numberOfLines={1}>{f.name}</Text>
              <Pressable onPress={() => removeFile(f.uri)} style={{ marginLeft: spacing.sm }}>
                <Text style={{ color: c.danger, fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={pickFile}
            style={{
              marginTop: spacing.xs,
              padding: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: c.primary, fontWeight: '600' }}>+ Add file</Text>
          </Pressable>
        </>
      )}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={{
          marginTop: spacing.md,
          padding: spacing.md,
          alignItems: 'center',
          backgroundColor: c.primary,
          borderRadius: radius.md,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? <ActivityIndicator color={c.primaryFg} /> : <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Submit</Text>}
      </Pressable>
    </ScrollView>
  );
}
