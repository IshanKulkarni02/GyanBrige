import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Cap {
  id: string;
  scope: 'GLOBAL' | 'SUBJECT';
  maxOnlineLectures: number;
  periodStart: string;
  periodEnd: string;
  subject?: { code: string; name: string } | null;
}

export default function AdminCaps() {
  const [rows, setRows] = useState<Cap[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalMax, setGlobalMax] = useState('10');
  const c = colors.light;

  const load = async () => {
    setLoading(true);
    setRows(await api<Cap[]>('/api/admin/caps'));
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const upsertGlobal = async () => {
    const now = new Date();
    const end = new Date(now.getTime() + 365 * 24 * 3600 * 1000);
    try {
      await api('/api/admin/caps', {
        method: 'POST',
        body: JSON.stringify({
          scope: 'GLOBAL',
          maxOnlineLectures: Number(globalMax),
          periodStart: now.toISOString(),
          periodEnd: end.toISOString(),
        }),
      });
      Alert.alert('Saved');
      await load();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  return (
    <View style={{ flex: 1, padding: spacing.md, backgroundColor: c.bg }}>
      <Text style={{ color: c.text, fontWeight: '600' }}>Global online cap (per student, 1 yr)</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        <TextInput
          value={globalMax}
          onChangeText={setGlobalMax}
          keyboardType="number-pad"
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
          onPress={upsertGlobal}
          style={{
            paddingHorizontal: spacing.md,
            justifyContent: 'center',
            borderRadius: radius.md,
            backgroundColor: c.primary,
          }}
        >
          <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Save</Text>
        </Pressable>
      </View>

      <Text style={{ color: c.text, fontWeight: '600', marginTop: spacing.lg }}>Active caps</Text>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
          renderItem={({ item }) => (
            <View style={{ padding: spacing.sm }}>
              <Text style={{ color: c.text }}>
                {item.scope} · max {item.maxOnlineLectures} online
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                {item.subject ? `${item.subject.code} · ${item.subject.name}` : 'all subjects'}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 11 }}>
                {new Date(item.periodStart).toLocaleDateString()} →{' '}
                {new Date(item.periodEnd).toLocaleDateString()}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
