import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface CourseRow {
  id: string;
  semester: number;
  year: number;
  subject: { name: string; code: string };
  teachers: { id: string; name: string }[];
  _count: { enrollments: number; lectures: number };
}

export default function CoursesList() {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<CourseRow[]>('/api/courses?mine=true')
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (rows.length === 0) {
    return (
      <View style={{ flex: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.textMuted }}>No courses yet.</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      style={{ backgroundColor: c.bg }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      contentContainerStyle={{ padding: spacing.md }}
      renderItem={({ item }) => (
        <Link href={`/(app)/courses/${item.id}`} asChild>
          <Pressable
            style={{
              padding: spacing.md,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '600' }}>
              {item.subject.code} · {item.subject.name}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              Sem {item.semester} / {item.year} · {item.teachers.map((t) => t.name).join(', ') || '—'}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              {item._count.enrollments} enrolled · {item._count.lectures} lectures
            </Text>
          </Pressable>
        </Link>
      )}
    />
  );
}
