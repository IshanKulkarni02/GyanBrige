import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Club {
  id: string;
  name: string;
  description: string | null;
  leads: { id: string; name: string }[];
  _count: { members: number; events: number };
  members: { id: string }[];
}

export default function Clubs() {
  const [rows, setRows] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  const load = async () => {
    setRows(await api<Club[]>('/api/clubs'));
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const join = async (id: string, joined: boolean) => {
    try {
      if (joined) await api(`/api/clubs/${id}/leave`, { method: 'DELETE' });
      else await api(`/api/clubs/${id}/join`, { method: 'POST' });
      await load();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(c2) => c2.id}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: spacing.md }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => {
        const joined = item.members.length > 0;
        return (
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>{item.name}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              {item._count.members} members · {item._count.events} events
            </Text>
            {item.description && (
              <Text style={{ color: c.text, marginTop: spacing.sm }}>{item.description}</Text>
            )}
            <Pressable
              onPress={() => join(item.id, joined)}
              style={{
                marginTop: spacing.sm,
                alignSelf: 'flex-start',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.sm,
                backgroundColor: joined ? c.danger : c.primary,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                {joined ? 'Leave' : 'Join'}
              </Text>
            </Pressable>
          </View>
        );
      }}
    />
  );
}
