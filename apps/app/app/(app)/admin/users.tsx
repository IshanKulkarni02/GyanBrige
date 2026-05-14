import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, ActivityIndicator, Pressable,
  Modal, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { api } from '../../../lib/api';
import { useColors, spacing, radius, typography } from '../../../lib/theme';
import { Button } from '../../../components/ui';

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  roles: { role: string; scopeId: string | null }[];
}

const ROLES = ['STUDENT', 'TEACHER', 'STAFF', 'ADMIN', 'CLUB_LEAD'] as const;

export default function AdminUsers() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'STUDENT' as typeof ROLES[number] });
  const [creating, setCreating] = useState(false);
  const c = useColors();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api<{ users: UserRow[] }>(`/api/users?q=${encodeURIComponent(q)}`);
      setRows(r.users);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async () => {
    if (!form.email.trim() || !form.name.trim() || !form.password) {
      Alert.alert('Fill in all fields');
      return;
    }
    setCreating(true);
    try {
      await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ email: form.email.trim(), name: form.name.trim(), password: form.password, role: form.role }),
      });
      setShowCreate(false);
      setForm({ email: '', name: '', password: '', role: 'STUDENT' });
      load();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            placeholder="Search name or email"
            placeholderTextColor={c.textMuted}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
            style={{
              flex: 1, borderWidth: 1, borderColor: c.border,
              borderRadius: radius.md, padding: spacing.sm, color: c.text,
              backgroundColor: c.surface,
            }}
          />
          <Pressable
            onPress={load}
            style={{ backgroundColor: c.primary, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radius.md }}
          >
            <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Search</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
          ListEmptyComponent={
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
              No users found. Tap + to create one.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={{ paddingVertical: spacing.sm }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>{item.email ?? '—'}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                {item.roles.map((r) => r.role).join(', ') || 'no roles'} · {item.isActive ? 'active' : 'disabled'}
              </Text>
            </View>
          )}
        />
      )}

      <Pressable
        onPress={() => setShowCreate(true)}
        style={{
          position: 'absolute', bottom: spacing.xl, right: spacing.lg,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25, shadowRadius: 4, elevation: 6,
        }}
      >
        <Text style={{ color: c.primaryFg, fontSize: 28, lineHeight: 32 }}>+</Text>
      </Pressable>

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ ...typography.h2, color: c.text }}>New User</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Text style={{ color: c.textMuted, fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </View>

            {([
              ['name', 'Full name', false],
              ['email', 'Email address', false],
              ['password', 'Password (min 8 chars)', true],
            ] as [keyof typeof form, string, boolean][]).map(([key, label, secure]) => (
              <View key={key} style={{ gap: spacing.xs }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>{label.toUpperCase()}</Text>
                <TextInput
                  value={form[key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  placeholder={label}
                  placeholderTextColor={c.textMuted}
                  secureTextEntry={secure}
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                    padding: spacing.md, color: c.text, backgroundColor: c.surface,
                  }}
                />
              </View>
            ))}

            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>ROLE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {ROLES.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setForm((f) => ({ ...f, role: r }))}
                    style={{
                      paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
                      borderRadius: radius.md, borderWidth: 1,
                      borderColor: form.role === r ? c.primary : c.border,
                      backgroundColor: form.role === r ? c.primary : c.surface,
                    }}
                  >
                    <Text style={{ color: form.role === r ? c.primaryFg : c.text, fontSize: 13, fontWeight: '600' }}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Button label="Create User" busy={creating} onPress={submit} full />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
