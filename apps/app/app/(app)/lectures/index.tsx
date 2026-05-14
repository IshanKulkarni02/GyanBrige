import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, Pressable,
  Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-store';
import { useColors, spacing, radius, typography } from '../../../lib/theme';
import { Button } from '../../../components/ui';

interface LectureRow {
  id: string;
  title: string;
  scheduledAt: string;
  mode: string;
  liveSession: { startedAt: string | null; endedAt: string | null } | null;
  course: { subject: { code: string; name: string } };
  _count: { attendances: number };
}

interface CourseOption {
  id: string;
  subject: { code: string; name: string };
}

const MODES = ['IN_PERSON', 'ONLINE', 'HYBRID'] as const;

export default function LecturesList() {
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();
  const [rows, setRows] = useState<LectureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [form, setForm] = useState({ courseId: '', title: '', scheduledAt: '', mode: 'IN_PERSON' as typeof MODES[number] });
  const [creating, setCreating] = useState(false);
  const c = useColors();

  const me = useAuth((s) => s.me);
  const roles = me?.roles.map((r) => r.role) ?? [];
  const canCreate = roles.includes('ADMIN') || roles.includes('STAFF') || roles.includes('TEACHER');

  const load = () => {
    const q = courseId ? `?courseId=${courseId}` : '';
    api<LectureRow[]>(`/api/lectures${q}`)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [courseId]);

  const openCreate = async () => {
    if (courses.length === 0) {
      const list = await api<CourseOption[]>('/api/courses').catch(() => []);
      setCourses(list);
      setForm((f) => ({ ...f, courseId: list[0]?.id ?? '' }));
    }
    const now = new Date();
    now.setMinutes(0, 0, 0);
    setForm((f) => ({
      ...f,
      title: '',
      scheduledAt: now.toISOString().slice(0, 16),
    }));
    setShowCreate(true);
  };

  const submit = async () => {
    if (!form.courseId || !form.title.trim() || !form.scheduledAt) {
      Alert.alert('Fill in all fields');
      return;
    }
    setCreating(true);
    try {
      await api('/api/lectures', {
        method: 'POST',
        body: JSON.stringify({
          courseId: form.courseId,
          title: form.title.trim(),
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          mode: form.mode,
        }),
      });
      setShowCreate(false);
      load();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
            No lectures yet.{canCreate ? ' Tap + to create one.' : ''}
          </Text>
        }
        renderItem={({ item }) => {
          const isLive = !!item.liveSession && !item.liveSession.endedAt;
          return (
            <Link href={`/(app)/lectures/${item.id}`} asChild>
              <Pressable
                style={{
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: isLive ? c.danger : c.border,
                  borderRadius: radius.md,
                  backgroundColor: c.surface,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>{item.title}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                  {item.course.subject.code} · {new Date(item.scheduledAt).toLocaleString()}
                </Text>
                <Text style={{ color: isLive ? c.danger : c.textMuted, fontSize: 12 }}>
                  {isLive ? '● LIVE' : item.mode} · {item._count.attendances} present
                </Text>
              </Pressable>
            </Link>
          );
        }}
      />

      {canCreate && (
        <Pressable
          onPress={openCreate}
          style={{
            position: 'absolute',
            bottom: spacing.xl,
            right: spacing.lg,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 6,
          }}
        >
          <Text style={{ color: c.primaryFg, fontSize: 28, lineHeight: 32, fontWeight: '400' }}>+</Text>
        </Pressable>
      )}

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={{ ...typography.h2, color: c.text }}>New Lecture</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Text style={{ color: c.textMuted, fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>COURSE</Text>
              <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, overflow: 'hidden' }}>
                {courses.map((co) => (
                  <Pressable
                    key={co.id}
                    onPress={() => setForm((f) => ({ ...f, courseId: co.id }))}
                    style={{
                      padding: spacing.md,
                      backgroundColor: form.courseId === co.id ? c.primary : c.surface,
                    }}
                  >
                    <Text style={{ color: form.courseId === co.id ? c.primaryFg : c.text, fontWeight: '600' }}>
                      {co.subject.code} — {co.subject.name}
                    </Text>
                  </Pressable>
                ))}
                {courses.length === 0 && (
                  <Text style={{ color: c.textMuted, padding: spacing.md }}>No courses found</Text>
                )}
              </View>
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>TITLE</Text>
              <TextInput
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholder="e.g. Week 3 — Sorting Algorithms"
                placeholderTextColor={c.textMuted}
                style={{
                  borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                  padding: spacing.md, color: c.text, backgroundColor: c.surface,
                }}
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>DATE & TIME (YYYY-MM-DDTHH:MM)</Text>
              <TextInput
                value={form.scheduledAt}
                onChangeText={(v) => setForm((f) => ({ ...f, scheduledAt: v }))}
                placeholder="2026-05-14T10:00"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                style={{
                  borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                  padding: spacing.md, color: c.text, backgroundColor: c.surface,
                  fontVariant: ['tabular-nums'],
                }}
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>MODE</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {MODES.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setForm((f) => ({ ...f, mode: m }))}
                    style={{
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: form.mode === m ? c.primary : c.border,
                      backgroundColor: form.mode === m ? c.primary : c.surface,
                    }}
                  >
                    <Text style={{ color: form.mode === m ? c.primaryFg : c.text, fontSize: 13, fontWeight: '600' }}>
                      {m.replace('_', ' ')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Button label="Create Lecture" busy={creating} onPress={submit} full />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
