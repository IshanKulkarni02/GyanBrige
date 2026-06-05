import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Modal, ScrollView, TextInput, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface InboxItem {
  id: string;
  kind: string;
  createdAt: string;
  payload: Record<string, unknown>;
  form: { name: string; workflow: { steps: { id: string; approverRole: string }[] } };
  applicant: { id: string; name: string };
}

export default function ApplicationsInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<InboxItem | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const c = colors.light;

  const load = async () => {
    setItems(await api<InboxItem[]>('/api/applications/inbox'));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const decide = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!active) return;
    setBusy(true);
    try {
      await api(`/api/applications/${active.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      setActive(null);
      setNote('');
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>Inbox empty</Text>
            <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>No applications pending your approval.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => { setActive(item); setNote(''); }}
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{item.form.name}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
              {item.applicant.name} · {item.kind}
            </Text>
          </Pressable>
        )}
      />

      <Modal visible={!!active} animationType="slide" presentationStyle="pageSheet">
        {active && (
          <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 20, flex: 1 }}>{active.form.name}</Text>
              <Pressable onPress={() => setActive(null)}>
                <Text style={{ color: c.primary }}>Close</Text>
              </Pressable>
            </View>

            <Text style={{ color: c.textMuted, fontSize: 13, marginBottom: spacing.md }}>
              From: {active.applicant.name} · {new Date(active.createdAt).toLocaleDateString()}
            </Text>

            <Text style={{ color: c.text, fontWeight: '600', marginBottom: spacing.sm }}>Submission</Text>
            {Object.entries(active.payload).map(([key, val]) => (
              <View key={key} style={{ marginBottom: spacing.sm }}>
                <Text style={{ color: c.textMuted, fontSize: 11, textTransform: 'uppercase' }}>{key}</Text>
                <Text style={{ color: c.text }}>{String(val)}</Text>
              </View>
            ))}

            <Text style={{ color: c.text, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.xs }}>
              Note (optional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Reason for approval or rejection…"
              style={{
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.md,
                padding: spacing.sm,
                color: c.text,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable
                onPress={() => decide('REJECTED')}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: c.danger,
                  alignItems: 'center',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Reject</Text>
              </Pressable>
              <Pressable
                onPress={() => decide('APPROVED')}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: c.success,
                  alignItems: 'center',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Approve</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </Modal>
    </>
  );
}
