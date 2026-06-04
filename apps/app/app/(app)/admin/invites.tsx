import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Invite {
  id: string;
  token: string;
  role: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  department?: { name: string } | null;
  course?: { subject: { name: string } } | null;
  createdBy?: { name: string } | null;
}

export default function AdminInvites() {
  const [rows, setRows] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const c = colors.light;

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<Invite[]>('/api/invites'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    const inv = await api<{ token: string; expiresAt: string }>('/api/auth/invites', {
      method: 'POST',
      body: JSON.stringify({ role: 'STUDENT', maxUses: 50, expiresInDays: 30 }),
    });
    Alert.alert('Invite created', `Token:\n${inv.token}\nExpires: ${inv.expiresAt}`);
    await load();
  };

  return (
    <View style={{ flex: 1, padding: spacing.md, backgroundColor: c.bg }}>
      <Pressable
        onPress={create}
        style={{
          backgroundColor: c.primary,
          padding: spacing.md,
          alignItems: 'center',
          borderRadius: radius.md,
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ color: c.primaryFg, fontWeight: '600' }}>+ New STUDENT invite (50 uses, 30d)</Text>
      </Pressable>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
          renderItem={({ item }) => (
            <View style={{ padding: spacing.sm }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>
                {item.role} · {item.department?.name ?? item.course?.subject.name ?? 'any'}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                {item.usedCount}/{item.maxUses} used · expires {new Date(item.expiresAt).toLocaleDateString()}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 11, fontFamily: 'monospace' }}>{item.token}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
