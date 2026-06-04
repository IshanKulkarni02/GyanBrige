import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-store';
import { useColors, spacing, radius, typography } from '../../../lib/theme';
import { Button, Surface } from '../../../components/ui';

interface TestRow {
  id: string;
  title: string;
  duration: number;
  opensAt: string;
  closesAt: string;
  _count: { questions: number; attempts: number };
}

interface CourseOption {
  id: string;
  subject: { code: string; name: string };
}

const defaultSettings = {
  shuffleQuestions: false,
  shuffleOptions: false,
  lockdown: true,
  strictProctoring: false,
  allowedAttempts: 1,
};

export default function TestsList() {
  const { courseId: paramCourseId } = useLocalSearchParams<{ courseId?: string }>();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourse, setSelectedCourse] = useState(paramCourseId ?? '');
  const [rows, setRows] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    duration: '60',
    opensAt: '',
    closesAt: '',
  });
  const [settings, setSettings] = useState({ ...defaultSettings });
  const [creating, setCreating] = useState(false);
  const c = useColors();

  const me = useAuth((s) => s.me);
  const roles = me?.roles.map((r) => r.role) ?? [];
  const canCreate = roles.includes('ADMIN') || roles.includes('STAFF') || roles.includes('TEACHER');

  useEffect(() => {
    api<CourseOption[]>('/api/courses').then((list) => {
      setCourses(list);
      if (!selectedCourse && list.length > 0) setSelectedCourse(list[0]!.id);
    });
  }, []);

  const loadTests = () => {
    if (!selectedCourse) return;
    setLoading(true);
    api<TestRow[]>(`/api/tests/course/${selectedCourse}`)
      .then(setRows).catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTests(); }, [selectedCourse]);

  const openCreate = () => {
    const now = new Date(); now.setMinutes(0, 0, 0);
    const close = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    setForm({
      title: '',
      duration: '60',
      opensAt: now.toISOString().slice(0, 16),
      closesAt: close.toISOString().slice(0, 16),
    });
    setSettings({ ...defaultSettings });
    setShowCreate(true);
  };

  const submit = async () => {
    if (!form.title.trim() || !form.opensAt || !form.closesAt || !selectedCourse) {
      Alert.alert('Fill in all fields');
      return;
    }
    setCreating(true);
    try {
      const test = await api<{ id: string }>('/api/tests', {
        method: 'POST',
        body: JSON.stringify({
          courseId: selectedCourse,
          title: form.title.trim(),
          duration: Number(form.duration) || 60,
          opensAt: new Date(form.opensAt).toISOString(),
          closesAt: new Date(form.closesAt).toISOString(),
          settings,
        }),
      });
      setShowCreate(false);
      loadTests();
      Alert.alert('Test created', 'Add questions from the test detail screen.', [
        { text: 'Add questions now', onPress: () => router.push(`/(app)/tests/${test.id}/edit` as never) },
        { text: 'Later', style: 'cancel' },
      ]);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{
        width: 22, height: 22, borderRadius: 4, borderWidth: 2,
        borderColor: value ? c.primary : c.border,
        backgroundColor: value ? c.primary : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {value && <Text style={{ color: c.primaryFg, fontSize: 13, fontWeight: '700' }}>✓</Text>}
      </View>
      <Text style={{ color: c.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );

  const now = new Date();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Course picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, flexDirection: 'row' }}>
        {courses.map((co) => (
          <Pressable
            key={co.id}
            onPress={() => setSelectedCourse(co.id)}
            style={{
              paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
              borderRadius: radius.md, borderWidth: 1,
              borderColor: selectedCourse === co.id ? c.primary : c.border,
              backgroundColor: selectedCourse === co.id ? c.primary : c.surface,
            }}
          >
            <Text style={{ color: selectedCourse === co.id ? c.primaryFg : c.text, fontWeight: '600', fontSize: 13 }}>
              {co.subject.code}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
              No tests yet.{canCreate ? ' Tap + to create one.' : ''}
            </Text>
          }
          renderItem={({ item }) => {
            const open = new Date(item.opensAt) <= now && new Date(item.closesAt) >= now;
            const past = new Date(item.closesAt) < now;
            return (
              <Pressable
                onPress={() => router.push(`/(app)/tests/${item.id}/attempt` as never)}
                style={{
                  padding: spacing.md, borderWidth: 1,
                  borderColor: open ? c.success : c.border,
                  borderRadius: radius.md, backgroundColor: c.surface,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{item.title}</Text>
                  <Text style={{ color: open ? c.success : past ? c.textMuted : c.accent, fontSize: 12, fontWeight: '600' }}>
                    {open ? '● OPEN' : past ? 'CLOSED' : 'UPCOMING'}
                  </Text>
                </View>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                  {item.duration} min · {item._count.questions} questions · {item._count.attempts} attempts
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>
                  {new Date(item.opensAt).toLocaleString()} → {new Date(item.closesAt).toLocaleString()}
                </Text>
              </Pressable>
            );
          }}
        />
      )}

      {canCreate && (
        <Pressable
          onPress={openCreate}
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
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ ...typography.h2, color: c.text }}>New Test</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Text style={{ color: c.textMuted, fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>TITLE</Text>
              <TextInput
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholder="e.g. Midterm Exam"
                placeholderTextColor={c.textMuted}
                style={{
                  borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                  padding: spacing.md, color: c.text, backgroundColor: c.surface,
                }}
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>DURATION (MINUTES)</Text>
              <TextInput
                value={form.duration}
                onChangeText={(v) => setForm((f) => ({ ...f, duration: v.replace(/[^0-9]/g, '') }))}
                keyboardType="number-pad"
                placeholder="60"
                placeholderTextColor={c.textMuted}
                style={{
                  borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                  padding: spacing.md, color: c.text, backgroundColor: c.surface,
                }}
              />
            </View>

            {(['opensAt', 'closesAt'] as const).map((key) => (
              <View key={key} style={{ gap: spacing.xs }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {key === 'opensAt' ? 'OPENS AT' : 'CLOSES AT'} (YYYY-MM-DDTHH:MM)
                </Text>
                <TextInput
                  value={form[key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  placeholder="2026-05-14T09:00"
                  placeholderTextColor={c.textMuted}
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                    padding: spacing.md, color: c.text, backgroundColor: c.surface,
                  }}
                />
              </View>
            ))}

            <Surface>
              <Text style={{ ...typography.micro, color: c.accent, marginBottom: spacing.sm }}>Settings</Text>
              <View style={{ gap: spacing.sm }}>
                <Toggle label="Shuffle questions" value={settings.shuffleQuestions}
                  onChange={(v) => setSettings((s) => ({ ...s, shuffleQuestions: v }))} />
                <Toggle label="Shuffle answer options" value={settings.shuffleOptions}
                  onChange={(v) => setSettings((s) => ({ ...s, shuffleOptions: v }))} />
                <Toggle label="Lockdown browser" value={settings.lockdown}
                  onChange={(v) => setSettings((s) => ({ ...s, lockdown: v }))} />
                <Toggle label="Strict proctoring (webcam)" value={settings.strictProctoring}
                  onChange={(v) => setSettings((s) => ({ ...s, strictProctoring: v }))} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ color: c.text, fontSize: 14 }}>Allowed attempts:</Text>
                  {[1, 2, 3].map((n) => (
                    <Pressable key={n} onPress={() => setSettings((s) => ({ ...s, allowedAttempts: n }))}
                      style={{
                        width: 36, height: 36, borderRadius: 18, borderWidth: 2,
                        borderColor: settings.allowedAttempts === n ? c.primary : c.border,
                        backgroundColor: settings.allowedAttempts === n ? c.primary : c.surface,
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                      <Text style={{ color: settings.allowedAttempts === n ? c.primaryFg : c.text, fontWeight: '700' }}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Surface>

            <Button label="Create Test" busy={creating} onPress={submit} full />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
