import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
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

interface NetworkInfo {
  ssid: string | null;
  bssid: string | null;
  ip: string | null;
}

// Try to invoke the Tauri desktop command; returns null on mobile/web
async function getDesktopNetwork(): Promise<NetworkInfo | null> {
  if (Platform.OS !== 'web') return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<NetworkInfo>('get_network_info');
  } catch {
    return null;
  }
}

export default function MyAttendance() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [marking, setMarking] = useState(false);
  const c = colors.light;

  const load = async () => {
    api<Row[]>('/api/attendance/me')
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
    getDesktopNetwork().then(setNetwork);
  }, []);

  const markNetworkAttendance = async () => {
    if (!network?.ssid) return;
    setMarking(true);
    try {
      const r = await api<{ marked: number }>('/api/attendance/network', {
        method: 'POST',
        body: JSON.stringify({ bssid: network.bssid }),
      });
      Alert.alert('Marked', `${r.marked} lecture${r.marked !== 1 ? 's' : ''} marked via network attendance.`);
      void load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        {/* Desktop: auto network mark-in */}
        {network && (
          <View style={{ padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>Campus network detected</Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
              {network.ssid ?? 'Unknown SSID'} · {network.bssid ?? '—'} · {network.ip ?? '—'}
            </Text>
            <Pressable
              onPress={markNetworkAttendance}
              disabled={marking}
              style={{ marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: c.success, alignItems: 'center', opacity: marking ? 0.6 : 1 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                {marking ? 'Marking…' : 'Mark attendance via network'}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Link href="/(app)/attendance/scan" asChild>
            <Pressable style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.primary, alignItems: 'center' }}>
              <Text style={{ color: c.primaryFg, fontWeight: '600' }}>NFC / QR mark-in</Text>
            </Pressable>
          </Link>
          {!network && (
            <Pressable
              onPress={markNetworkAttendance}
              disabled={marking}
              style={{ flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>Network mark-in</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
        ListEmptyComponent={<Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.lg }}>No attendance records yet.</Text>}
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
