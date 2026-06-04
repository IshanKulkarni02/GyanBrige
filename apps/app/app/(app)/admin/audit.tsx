import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing } from '../../../lib/theme';

interface AuditRow {
  id: string;
  actor?: { name: string; email: string | null } | null;
  action: string;
  resource: string;
  resourceId: string | null;
  at: string;
  ip: string | null;
}

export default function AdminAudit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<{ entries: AuditRow[] }>('/api/audit?limit=100')
      .then((r) => setRows(r.entries))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.id}
      style={{ backgroundColor: c.bg }}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
      renderItem={({ item }) => (
        <View style={{ padding: spacing.sm }}>
          <Text style={{ color: c.text }}>{item.action}</Text>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>
            {item.actor?.name ?? 'system'} · {new Date(item.at).toLocaleString()} · {item.ip ?? '—'}
          </Text>
        </View>
      )}
    />
  );
}
