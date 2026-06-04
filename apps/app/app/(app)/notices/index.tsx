import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Notice {
  id: string;
  title: string;
  body: string;
  scope: string;
  pinned: boolean;
  publishedAt: string;
  acks: { ackedAt: string }[];
}

export default function Notices() {
  const [rows, setRows] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  const load = async () => {
    setRows(await api<Notice[]>('/api/notices'));
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const ack = async (id: string) => {
    await api(`/api/notices/${id}/ack`, { method: 'POST' });
    await load();
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(n) => n.id}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: spacing.md }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => {
        const acked = item.acks.length > 0;
        return (
          <View
            style={{
              padding: spacing.md,
              borderWidth: 1,
              borderColor: item.pinned ? c.primary : c.border,
              borderRadius: radius.md,
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>
              {item.pinned ? '📌 ' : ''}
              {item.title}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              {item.scope} · {new Date(item.publishedAt).toLocaleDateString()}
            </Text>
            <Text style={{ color: c.text, marginTop: spacing.sm, lineHeight: 20 }}>{item.body}</Text>
            {!acked && (
              <Pressable
                onPress={() => ack(item.id)}
                style={{
                  marginTop: spacing.sm,
                  alignSelf: 'flex-start',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.sm,
                  backgroundColor: c.primary,
                }}
              >
                <Text style={{ color: c.primaryFg, fontSize: 12, fontWeight: '600' }}>
                  Acknowledge
                </Text>
              </Pressable>
            )}
            {acked && (
              <Text style={{ color: c.success, fontSize: 12, marginTop: spacing.sm }}>
                ✓ Acknowledged
              </Text>
            )}
          </View>
        );
      }}
    />
  );
}
