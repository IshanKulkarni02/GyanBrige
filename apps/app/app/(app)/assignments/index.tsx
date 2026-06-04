import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-store';
import { useColors, spacing, radius, typography } from '../../../lib/theme';
import { Button } from '../../../components/ui';

interface Assignment {
  id: string;
  title: string;
  brief: string;
  dueAt: string;
  maxScore: number;
  submissions: { id: string; status: string; score: number | null }[];
}

interface CourseOption {
  id: string;
  subject: { code: string; name: string };
}

export default function Assignments() {
  const { courseId: paramCourseId } = useLocalSearchParams<{ courseId?: string }>();
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourse, setSelectedCourse] = useState(paramCourseId ?? '');
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', brief: '', dueAt: '', maxScore: '100', allowsLate: false });
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

  useEffect(() => {
    if (!selectedCourse) return;
    setLoading(true);
    api<Assignment[]>(`/api/assignments/course/${selectedCourse}`)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [selectedCourse]);

  const submit = async () => {
    if (!form.title.trim() || !form.brief.trim() || !form.dueAt || !selectedCourse) {
      Alert.alert('Fill in all fields');
      return;
    }
    setCreating(true);
    try {
      await api('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          courseId: selectedCourse,
          title: form.title.trim(),
          brief: form.brief.trim(),
          dueAt: new Date(form.dueAt).toISOString(),
          maxScore: Number(form.maxScore) || 100,
          allowsLate: form.allowsLate,
        }),
      });
      setShowCreate(false);
      setForm({ title: '', brief: '', dueAt: '', maxScore: '100', allowsLate: false });
      // reload
      setLoading(true);
      api<Assignment[]>(`/api/assignments/course/${selectedCourse}`)
        .then(setRows).finally(() => setLoading(false));
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const selectedName = courses.find((c) => c.id === selectedCourse)?.subject.code ?? '';

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
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
              No assignments for {selectedName}.{canCreate ? ' Tap + to create one.' : ''}
            </Text>
          }
          renderItem={({ item }) => {
            const sub = item.submissions[0];
            return (
              <Link href={`/(app)/assignments/${item.id}`} asChild>
                <Pressable style={{
                  padding: spacing.md, borderWidth: 1, borderColor: c.border,
                  borderRadius: radius.md, backgroundColor: c.surface,
                }}>
                  <Text style={{ color: c.text, fontWeight: '600' }}>{item.title}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                    Due {new Date(item.dueAt).toLocaleString()} · max {item.maxScore} pts
                  </Text>
                  <Text style={{ color: sub ? c.success : c.danger, fontSize: 12 }}>
                    {sub ? `${sub.status}${sub.score != null ? ` · ${sub.score}/${item.maxScore}` : ''}` : 'Not submitted'}
                  </Text>
                </Pressable>
              </Link>
            );
          }}
        />
      )}

      {canCreate && (
        <Pressable
          onPress={() => {
            const now = new Date(); now.setDate(now.getDate() + 7); now.setMinutes(0, 0, 0);
            setForm((f) => ({ ...f, dueAt: now.toISOString().slice(0, 16) }));
            setShowCreate(true);
          }}
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
              <Text style={{ ...typography.h2, color: c.text }}>New Assignment</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Text style={{ color: c.textMuted, fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </View>

            {([
              ['title', 'Title', false],
              ['brief', 'Brief / instructions', false],
            ] as const).map(([key, label]) => (
              <View key={key} style={{ gap: spacing.xs }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>{label.toUpperCase()}</Text>
                <TextInput
                  value={form[key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  placeholder={label}
                  placeholderTextColor={c.textMuted}
                  multiline={key === 'brief'}
                  style={{
                    borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                    padding: spacing.md, color: c.text, backgroundColor: c.surface,
                    minHeight: key === 'brief' ? 80 : undefined, textAlignVertical: key === 'brief' ? 'top' : undefined,
                  }}
                />
              </View>
            ))}

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 2, gap: spacing.xs }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>DUE DATE (YYYY-MM-DDTHH:MM)</Text>
                <TextInput
                  value={form.dueAt}
                  onChangeText={(v) => setForm((f) => ({ ...f, dueAt: v }))}
                  placeholder="2026-05-21T23:59"
                  placeholderTextColor={c.textMuted}
                  autoCapitalize="none"
                  style={{
                    borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                    padding: spacing.md, color: c.text, backgroundColor: c.surface,
                  }}
                />
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>MAX SCORE</Text>
                <TextInput
                  value={form.maxScore}
                  onChangeText={(v) => setForm((f) => ({ ...f, maxScore: v.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  placeholder="100"
                  placeholderTextColor={c.textMuted}
                  style={{
                    borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                    padding: spacing.md, color: c.text, backgroundColor: c.surface,
                  }}
                />
              </View>
            </View>

            <Pressable
              onPress={() => setForm((f) => ({ ...f, allowsLate: !f.allowsLate }))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 4, borderWidth: 2,
                borderColor: form.allowsLate ? c.primary : c.border,
                backgroundColor: form.allowsLate ? c.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {form.allowsLate && <Text style={{ color: c.primaryFg, fontSize: 13, fontWeight: '700' }}>✓</Text>}
              </View>
              <Text style={{ color: c.text, fontSize: 14 }}>Allow late submissions (24h window)</Text>
            </Pressable>

            <Button label="Create Assignment" busy={creating} onPress={submit} full />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
