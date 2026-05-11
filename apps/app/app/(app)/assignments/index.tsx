import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Assignment {
  id: string;
  title: string;
  dueAt: string;
  maxScore: number;
  submissions: { id: string; status: string; score: number | null }[];
}

export default function Assignments() {
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();
  const [cid, setCid] = useState(courseId ?? '');
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const c = colors.light;

  const load = async () => {
    if (!cid) return;
    setLoading(true);
    try {
      setRows(await api<Assignment[]>(`/api/assignments/course/${cid}`));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [cid]);

  return (
    <View style={{ flex: 1, padding: spacing.md, backgroundColor: c.bg }}>
      <TextInput
        placeholder="Course ID"
        value={cid}
        onChangeText={setCid}
        onSubmitEditing={load}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          padding: spacing.sm,
          color: c.text,
          marginBottom: spacing.md,
        }}
      />
      {loading && <ActivityIndicator />}
      <FlatList
        data={rows}
        keyExtractor={(a) => a.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => {
          const sub = item.submissions[0];
          return (
            <Link href={`/(app)/assignments/${item.id}`} asChild>
              <Pressable
                style={{
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: radius.md,
                  backgroundColor: c.surface,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>{item.title}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                  Due {new Date(item.dueAt).toLocaleString()} · max {item.maxScore}
                </Text>
                <Text style={{ color: sub ? c.success : c.danger, fontSize: 12 }}>
                  {sub ? `${sub.status}${sub.score != null ? ` · ${sub.score}/${item.maxScore}` : ''}` : 'Not submitted'}
                </Text>
              </Pressable>
            </Link>
          );
        }}
      />
    </View>
  );
}
