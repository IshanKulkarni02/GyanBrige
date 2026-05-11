import { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  roles: { role: string; scopeId: string | null }[];
}

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const c = colors.light;

  const load = async () => {
    setLoading(true);
    try {
      const r = await api<{ users: UserRow[] }>(`/api/users?q=${encodeURIComponent(q)}`);
      setRows(r.users);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  return (
    <View style={{ flex: 1, padding: spacing.md, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <TextInput
          placeholder="Search name or email"
          value={q}
          onChangeText={setQ}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            padding: spacing.sm,
            color: c.text,
          }}
        />
        <Pressable
          onPress={load}
          style={{
            backgroundColor: c.primary,
            paddingHorizontal: spacing.md,
            justifyContent: 'center',
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Search</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(u) => u.id}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
          renderItem={({ item }) => (
            <View style={{ padding: spacing.sm }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ color: c.textMuted }}>{item.email ?? '—'}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                {item.roles.map((r) => r.role).join(', ') || 'no roles'} ·{' '}
                {item.isActive ? 'active' : 'disabled'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
