import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Result {
  id: string;
  semester: number;
  gpa: number | null;
  sgpa: number | null;
  components: Record<string, number>;
  publishedAt: string;
  course: { subject: { code: string; name: string } };
}

export default function MyResults() {
  const [rows, setRows] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<Result[]>('/api/results/me')
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: spacing.md }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
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
          <Text style={{ color: c.text, fontWeight: '600' }}>
            {item.course.subject.code} · {item.course.subject.name}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
            Sem {item.semester} · GPA {item.gpa ?? '—'} · SGPA {item.sgpa ?? '—'}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            {Object.entries(item.components).map(([k, v]) => (
              <Text key={k} style={{ color: c.text, fontSize: 13 }}>
                {k}: {v}
              </Text>
            ))}
          </View>
        </View>
      )}
    />
  );
}
