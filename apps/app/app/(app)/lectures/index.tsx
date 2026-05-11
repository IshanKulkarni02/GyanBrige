import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface LectureRow {
  id: string;
  title: string;
  scheduledAt: string;
  mode: string;
  liveSession: { startedAt: string | null; endedAt: string | null } | null;
  course: { subject: { code: string; name: string } };
  _count: { attendances: number };
}

export default function LecturesList() {
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();
  const [rows, setRows] = useState<LectureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    const q = courseId ? `?courseId=${courseId}` : '';
    api<LectureRow[]>(`/api/lectures${q}`)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: spacing.md }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => {
        const isLive = !!item.liveSession && !item.liveSession.endedAt;
        return (
          <Link href={`/(app)/lectures/${item.id}`} asChild>
            <Pressable
              style={{
                padding: spacing.md,
                borderWidth: 1,
                borderColor: isLive ? c.danger : c.border,
                borderRadius: radius.md,
                backgroundColor: c.surface,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>{item.title}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                {item.course.subject.code} · {new Date(item.scheduledAt).toLocaleString()}
              </Text>
              <Text style={{ color: isLive ? c.danger : c.textMuted, fontSize: 12 }}>
                {isLive ? '● LIVE' : item.mode} · {item._count.attendances} present
              </Text>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}
