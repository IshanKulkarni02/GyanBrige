// Unified attendance scan screen. Tries NFC first; falls back to manual QR
// payload paste. Real QR camera is wired on web/native via expo-camera in
// later commits — this is the cross-platform skeleton + endpoint plumbing.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { readNfcOnce } from '../../../lib/nfc';
import { selfReportNetwork } from '../../../lib/network';
import { colors, spacing, radius } from '../../../lib/theme';

export default function AttendanceScan() {
  const { lectureId: pre } = useLocalSearchParams<{ lectureId?: string }>();
  const [lectureId, setLectureId] = useState(pre ?? '');
  const [tagId, setTagId] = useState('');
  const [payload, setPayload] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const c = colors.light;

  useEffect(() => {
    if (pre) setLectureId(pre);
  }, [pre]);

  const scanNfc = async () => {
    setBusy(true);
    try {
      const r = await readNfcOnce();
      const [tid, ...rest] = r.payload.split(':');
      if (rest.length > 0) {
        setTagId(tid ?? '');
        setPayload(rest.join(':'));
      } else {
        setPayload(r.payload);
      }
      setLast(`Read ${r.source}: ${r.payload.slice(0, 40)}...`);
    } catch (e) {
      Alert.alert('NFC read failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mark = async (source: 'NFC' | 'QR') => {
    if (!lectureId || !tagId || !payload) {
      Alert.alert('Missing', 'Lecture ID, tag ID, and payload required.');
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ id: string; mode: string }>('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({
          lectureId,
          source,
          evidence: { tagId, payload },
        }),
      });
      Alert.alert('Marked', `Attendance recorded · ${r.mode}`);
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const markNetwork = async () => {
    if (!lectureId) return;
    setBusy(true);
    try {
      const net = await selfReportNetwork();
      const r = await api<{ id: string }>('/api/attendance/network', {
        method: 'POST',
        body: JSON.stringify({ lectureId, ip: net.ip, bssid: net.bssid, ssid: net.ssid }),
      });
      Alert.alert('Marked', `Network attendance recorded · ${r.id.slice(0, 8)}`);
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: spacing.lg, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>Mark attendance</Text>

      <Text style={{ marginTop: spacing.md, color: c.text }}>Lecture ID</Text>
      <TextInput
        value={lectureId}
        onChangeText={setLectureId}
        autoCapitalize="none"
        style={inputStyle(c)}
      />

      <Pressable
        onPress={scanNfc}
        disabled={busy}
        style={{
          marginTop: spacing.md,
          padding: spacing.md,
          backgroundColor: c.primary,
          borderRadius: radius.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Tap NFC / USB reader</Text>
      </Pressable>
      {last && (
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>{last}</Text>
      )}

      <Text style={{ marginTop: spacing.md, color: c.text }}>Tag ID</Text>
      <TextInput value={tagId} onChangeText={setTagId} autoCapitalize="none" style={inputStyle(c)} />
      <Text style={{ marginTop: spacing.md, color: c.text }}>Signed payload (or paste QR)</Text>
      <TextInput
        value={payload}
        onChangeText={setPayload}
        autoCapitalize="none"
        multiline
        style={{ ...inputStyle(c), minHeight: 80 }}
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Pressable
          onPress={() => mark('NFC')}
          disabled={busy}
          style={{ flex: 1, padding: spacing.md, alignItems: 'center', backgroundColor: c.primary, borderRadius: radius.md }}
        >
          {busy ? <ActivityIndicator color={c.primaryFg} /> : <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Submit NFC</Text>}
        </Pressable>
        <Pressable
          onPress={() => mark('QR')}
          disabled={busy}
          style={{ flex: 1, padding: spacing.md, alignItems: 'center', borderColor: c.primary, borderWidth: 1, borderRadius: radius.md }}
        >
          <Text style={{ color: c.primary, fontWeight: '600' }}>Submit QR</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={markNetwork}
        disabled={busy}
        style={{
          marginTop: spacing.lg,
          padding: spacing.md,
          alignItems: 'center',
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.md,
        }}
      >
        <Text style={{ color: c.text }}>I'm on campus Wi-Fi (network self-report)</Text>
      </Pressable>
    </View>
  );
}

function inputStyle(c: typeof colors.light) {
  return {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: c.text,
    marginTop: spacing.xs,
  };
}
