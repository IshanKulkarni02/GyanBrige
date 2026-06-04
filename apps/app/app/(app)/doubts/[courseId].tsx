import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Doubt {
  id: string;
  question: string;
  aiAnswer: string | null;
  upvotes: number;
  askedAt: string;
  student: { name: string };
  aiCitations: { lectureId: string; startSec: number }[] | null;
}

export default function CourseDoubts() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [rows, setRows] = useState<Doubt[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  const load = async () => {
    if (!courseId) return;
    setRows(await api<Doubt[]>(`/api/doubts/course/${courseId}`));
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, [courseId]);

  const ask = async () => {
    if (!q.trim() || !courseId) return;
    setBusy(true);
    try {
      await api('/api/doubts', {
        method: 'POST',
        body: JSON.stringify({ courseId, question: q }),
      });
      setQ('');
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upvote = async (id: string) => {
    await api(`/api/doubts/${id}/upvote`, { method: 'POST' });
    await load();
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Ask a doubt — AI drafts an answer with lecture citations"
          multiline
          style={{
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            padding: spacing.sm,
            color: c.text,
            minHeight: 60,
            textAlignVertical: 'top',
          }}
        />
        <Pressable
          onPress={ask}
          disabled={busy}
          style={{
            padding: spacing.sm,
            backgroundColor: c.primary,
            borderRadius: radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Post doubt</Text>
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View
            style={{
              padding: spacing.md,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '600' }}>{item.question}</Text>
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: spacing.xs }}>
              {item.student.name} · {new Date(item.askedAt).toLocaleDateString()}
            </Text>
            {item.aiAnswer && (
              <View
                style={{
                  marginTop: spacing.sm,
                  padding: spacing.sm,
                  backgroundColor: c.bg,
                  borderRadius: radius.sm,
                }}
              >
                <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '600' }}>AI DRAFT</Text>
                <Text style={{ color: c.text, marginTop: spacing.xs }}>{item.aiAnswer}</Text>
              </View>
            )}
            <Pressable
              onPress={() => upvote(item.id)}
              style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }}
            >
              <Text style={{ color: c.primary, fontSize: 12 }}>▲ {item.upvotes}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
