import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Row {
  id: string;
  mode: string;
  source: string;
  markedAt: string;
  lecture: { title: string; course: { subject: { code: string; name: string } } };
}

export default function MyAttendance() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<Row[]>('/api/attendance/me')
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm }}>
        <Link href="/(app)/attendance/scan" asChild>
          <Pressable
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: c.primary,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: c.primaryFg, fontWeight: '600' }}>NFC / QR mark-in</Text>
          </Pressable>
        </Link>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
        renderItem={({ item }) => (
          <View style={{ padding: spacing.sm }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>{item.lecture.title}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12 }}>
              {item.lecture.course.subject.code} · {item.mode} · via {item.source}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 11 }}>
              {new Date(item.markedAt).toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
