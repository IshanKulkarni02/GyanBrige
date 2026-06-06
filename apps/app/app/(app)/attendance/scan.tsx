// Unified attendance scan screen.
// Supports: QR camera scan, NFC tap, manual paste, and campus Wi-Fi self-report.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, Alert, TextInput,
  StyleSheet, Dimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { api } from '../../../lib/api';
import { readNfcOnce } from '../../../lib/nfc';
import { selfReportNetwork } from '../../../lib/network';
import { colors, spacing, radius } from '../../../lib/theme';

const { width } = Dimensions.get('window');

type Mode = 'camera' | 'manual';

export default function AttendanceScan() {
  const { lectureId: pre } = useLocalSearchParams<{ lectureId?: string }>();
  const [lectureId, setLectureId] = useState(pre ?? '');
  const [tagId, setTagId] = useState('');
  const [payload, setPayload] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('camera');
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const c = colors.light;

  useEffect(() => { if (pre) setLectureId(pre); }, [pre]);

  // ── QR scan handler ─────────────────────────────────────────────────────────
  const handleBarcode = ({ data }: BarcodeScanningResult) => {
    if (scanned || !data) return;
    setScanned(true);
    setLast(`QR scanned: ${data.slice(0, 40)}…`);

    // QR payload format: "tagId:signedPayload" or just the signed payload
    const colonIdx = data.indexOf(':');
    if (colonIdx > 0 && colonIdx < 40) {
      setTagId(data.slice(0, colonIdx));
      setPayload(data.slice(colonIdx + 1));
    } else {
      setPayload(data);
    }

    // Auto-submit if lectureId is already known
    if (lectureId) {
      void markWithData('QR', lectureId, data.slice(0, colonIdx > 0 ? colonIdx : 0), data.slice(colonIdx + 1));
    } else {
      Alert.alert('QR scanned', 'Now enter your Lecture ID and tap Submit QR.');
    }
  };

  // ── NFC scan ────────────────────────────────────────────────────────────────
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
      setLast(`NFC read: ${r.payload.slice(0, 40)}…`);
    } catch (e) {
      Alert.alert('NFC read failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Shared submit ────────────────────────────────────────────────────────────
  const markWithData = async (source: 'NFC' | 'QR', lid: string, tid: string, pay: string) => {
    if (!lid) { Alert.alert('Missing', 'Enter your Lecture ID first.'); return; }
    if (!pay) { Alert.alert('Missing', 'No payload — scan again or paste manually.'); return; }
    setBusy(true);
    try {
      const r = await api<{ id: string; mode: string }>('/api/attendance', {
        method: 'POST',
        body: JSON.stringify({ lectureId: lid, source, evidence: { tagId: tid, payload: pay } }),
      });
      Alert.alert('✓ Marked', `Attendance recorded · ${r.mode}`, [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
    } catch (e) {
      Alert.alert('Failed', (e as Error).message, [
        { text: 'Try again', onPress: () => setScanned(false) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const mark = (source: 'NFC' | 'QR') =>
    markWithData(source, lectureId, tagId, payload);

  const markNetwork = async () => {
    if (!lectureId) { Alert.alert('Missing', 'Enter your Lecture ID first.'); return; }
    setBusy(true);
    try {
      const net = await selfReportNetwork();
      await api('/api/attendance/network', {
        method: 'POST',
        body: JSON.stringify({ lectureId, ip: net.ip, bssid: net.bssid, ssid: net.ssid }),
      });
      Alert.alert('✓ Marked', 'Network attendance recorded.');
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ── Camera permission states ─────────────────────────────────────────────────
  if (mode === 'camera') {
    if (!permission) return <ActivityIndicator style={{ marginTop: 40 }} />;

    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <Text style={{ color: c.text, fontSize: 16, textAlign: 'center', marginBottom: spacing.md }}>
            Camera access is needed to scan QR codes.
          </Text>
          <Pressable onPress={requestPermission}
            style={{ padding: spacing.md, backgroundColor: c.primary, borderRadius: radius.md }}>
            <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Allow camera</Text>
          </Pressable>
          <Pressable onPress={() => setMode('manual')} style={{ marginTop: spacing.md }}>
            <Text style={{ color: c.primary }}>Enter manually instead</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Lecture ID bar at top */}
        <View style={{ padding: spacing.md, backgroundColor: c.bg }}>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>Lecture ID (leave blank to fill after scan)</Text>
          <TextInput
            value={lectureId}
            onChangeText={setLectureId}
            placeholder="auto-filled by teacher QR or enter manually"
            placeholderTextColor={c.textMuted}
            autoCapitalize="none"
            style={{
              color: c.text, borderBottomWidth: 1, borderBottomColor: c.border,
              paddingVertical: spacing.xs, fontSize: 13,
            }}
          />
        </View>

        {/* Camera viewfinder */}
        <View style={{ flex: 1 }}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleBarcode}
          >
            {/* Viewfinder overlay */}
            <View style={styles.overlay}>
              <View style={styles.finder} />
            </View>
          </CameraView>

          {/* Status */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : scanned ? (
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ color: '#4ade80', fontWeight: '700', fontSize: 16 }}>QR captured!</Text>
                <Pressable onPress={() => setScanned(false)} style={{ padding: spacing.sm }}>
                  <Text style={{ color: '#fff' }}>Scan again</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ color: '#fff', textAlign: 'center', opacity: 0.8 }}>
                Point at the classroom QR code
              </Text>
            )}
          </View>
        </View>

        {/* Bottom actions */}
        <View style={{ backgroundColor: c.bg, padding: spacing.md, gap: spacing.sm }}>
          {last && <Text style={{ color: c.textMuted, fontSize: 12 }}>{last}</Text>}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable onPress={scanNfc} disabled={busy}
              style={{ flex: 1, padding: spacing.sm, backgroundColor: c.primary, borderRadius: radius.md, alignItems: 'center' }}>
              <Text style={{ color: c.primaryFg, fontWeight: '600', fontSize: 13 }}>NFC tap</Text>
            </Pressable>
            <Pressable onPress={markNetwork} disabled={busy}
              style={{ flex: 1, padding: spacing.sm, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 13 }}>Wi-Fi self-report</Text>
            </Pressable>
            <Pressable onPress={() => { setMode('manual'); setScanned(false); }}
              style={{ flex: 1, padding: spacing.sm, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 13 }}>Manual</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Manual mode ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, padding: spacing.lg, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>Mark attendance</Text>
        <Pressable onPress={() => setMode('camera')}>
          <Text style={{ color: c.primary, fontWeight: '600' }}>📷 Scan QR</Text>
        </Pressable>
      </View>

      <Text style={{ color: c.text }}>Lecture ID</Text>
      <TextInput value={lectureId} onChangeText={setLectureId} autoCapitalize="none" style={inputStyle(c)} />

      <Pressable onPress={scanNfc} disabled={busy}
        style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: c.primary, borderRadius: radius.md, alignItems: 'center' }}>
        <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Tap NFC / USB reader</Text>
      </Pressable>
      {last && <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>{last}</Text>}

      <Text style={{ marginTop: spacing.md, color: c.text }}>Tag ID</Text>
      <TextInput value={tagId} onChangeText={setTagId} autoCapitalize="none" style={inputStyle(c)} />

      <Text style={{ marginTop: spacing.md, color: c.text }}>Signed payload (paste QR data)</Text>
      <TextInput value={payload} onChangeText={setPayload} autoCapitalize="none"
        multiline placeholder="Paste QR code data here…"
        style={{ ...inputStyle(c), minHeight: 80 }} />

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Pressable onPress={() => mark('NFC')} disabled={busy}
          style={{ flex: 1, padding: spacing.md, alignItems: 'center', backgroundColor: c.primary, borderRadius: radius.md }}>
          {busy ? <ActivityIndicator color={c.primaryFg} /> : <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Submit NFC</Text>}
        </Pressable>
        <Pressable onPress={() => mark('QR')} disabled={busy}
          style={{ flex: 1, padding: spacing.md, alignItems: 'center', borderColor: c.primary, borderWidth: 1, borderRadius: radius.md }}>
          <Text style={{ color: c.primary, fontWeight: '600' }}>Submit QR</Text>
        </Pressable>
      </View>

      <Pressable onPress={markNetwork} disabled={busy}
        style={{ marginTop: spacing.lg, padding: spacing.md, alignItems: 'center', borderColor: c.border, borderWidth: 1, borderRadius: radius.md }}>
        <Text style={{ color: c.text }}>I'm on campus Wi-Fi (network self-report)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  finder: {
    width: width * 0.65,
    height: width * 0.65,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
});

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
