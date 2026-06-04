import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Application {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
  form: { name: string };
}

export default function MyApplications() {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<Application[]>('/api/applications/mine')
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(a) => a.id}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: spacing.md }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => {
        const color =
          item.status === 'APPROVED' ? c.success : item.status === 'REJECTED' ? c.danger : c.textMuted;
        return (
          <View
            style={{
              padding: spacing.md,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '600' }}>{item.form.name}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              {item.kind} · {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            <Text style={{ color, fontWeight: '600', marginTop: spacing.xs }}>{item.status}</Text>
          </View>
        );
      }}
    />
  );
}
