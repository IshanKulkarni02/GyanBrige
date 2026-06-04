import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
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
    plagiarismScore: number | null;
  }[];
}

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [a, setA] = useState<Assignment | null>(null);
  const [text, setText] = useState('');
  const [git, setGit] = useState('');
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
  useEffect(() => {
    void load();
  }, [id]);

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/assignments/${id}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ contentText: text || undefined, gitRepoUrl: git || undefined, files: [] }),
      });
      Alert.alert('Submitted');
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!a) return <ActivityIndicator style={{ marginTop: 32 }} />;
  const sub = a.submissions[0];

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
          {sub.plagiarismScore != null && (
            <Text style={{ color: sub.plagiarismScore > 0.4 ? c.danger : c.textMuted }}>
              Plagiarism similarity: {(sub.plagiarismScore * 100).toFixed(0)}%
            </Text>
          )}
        </View>
      )}

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
