import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, Pressable,
  Modal, KeyboardAvoidingView, Platform, ScrollView, TextInput, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-store';
import { useColors, spacing, radius, typography } from '../../../lib/theme';
import { Button } from '../../../components/ui';

interface CourseRow {
  id: string;
  semester: number;
  year: number;
  subject: { name: string; code: string };
  teachers: { id: string; name: string }[];
  _count: { enrollments: number; lectures: number };
}

interface SubjectOption {
  id: string;
  code: string;
  name: string;
  department: { name: string };
}

export default function CoursesList() {
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [form, setForm] = useState({ subjectId: '', semester: '1', year: String(new Date().getFullYear()) });
  const [creating, setCreating] = useState(false);
  const c = useColors();

  const me = useAuth((s) => s.me);
  const roles = me?.roles.map((r) => r.role) ?? [];
  const isAdmin = roles.includes('ADMIN') || roles.includes('STAFF');

  const load = () => {
    const q = isAdmin ? '' : '?mine=true';
    api<CourseRow[]>(`/api/courses${q}`)
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = async () => {
    if (subjects.length === 0) {
      const list = await api<SubjectOption[]>('/api/subjects').catch(() => []);
      setSubjects(list);
      setForm((f) => ({ ...f, subjectId: list[0]?.id ?? '' }));
    }
    setShowCreate(true);
  };

  const submit = async () => {
    if (!form.subjectId || !form.semester || !form.year) {
      Alert.alert('Fill in all fields');
      return;
    }
    setCreating(true);
    try {
      await api('/api/courses', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: form.subjectId,
          semester: Number(form.semester),
          year: Number(form.year),
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
            No courses yet.{isAdmin ? ' Tap + to create one.' : ''}
          </Text>
        }
        renderItem={({ item }) => (
          <Link href={`/(app)/courses/${item.id}`} asChild>
            <Pressable
              style={{
                padding: spacing.md, borderWidth: 1, borderColor: c.border,
                borderRadius: radius.md, backgroundColor: c.surface,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>
                {item.subject.code} · {item.subject.name}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                Sem {item.semester} / {item.year} · {item.teachers.map((t) => t.name).join(', ') || '—'}
              </Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                {item._count.enrollments} enrolled · {item._count.lectures} lectures
              </Text>
            </Pressable>
          </Link>
        )}
      />

      {isAdmin && (
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
              <Text style={{ ...typography.h2, color: c.text }}>New Course</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Text style={{ color: c.textMuted, fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>SUBJECT</Text>
              <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, overflow: 'hidden' }}>
                {subjects.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => setForm((f) => ({ ...f, subjectId: s.id }))}
                    style={{
                      padding: spacing.md,
                      backgroundColor: form.subjectId === s.id ? c.primary : c.surface,
                    }}
                  >
                    <Text style={{ color: form.subjectId === s.id ? c.primaryFg : c.text, fontWeight: '600' }}>
                      {s.code} — {s.name}
                    </Text>
                    <Text style={{ color: form.subjectId === s.id ? c.primaryFg : c.textMuted, fontSize: 12 }}>
                      {s.department.name}
                    </Text>
                  </Pressable>
                ))}
                {subjects.length === 0 && (
                  <Text style={{ color: c.textMuted, padding: spacing.md }}>No subjects found. Create a subject first.</Text>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>SEMESTER</Text>
                <TextInput
                  value={form.semester}
                  onChangeText={(v) => setForm((f) => ({ ...f, semester: v.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={c.textMuted}
                  style={{
                    borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                    padding: spacing.md, color: c.text, backgroundColor: c.surface,
                  }}
                />
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>YEAR</Text>
                <TextInput
                  value={form.year}
                  onChangeText={(v) => setForm((f) => ({ ...f, year: v.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  placeholder="2026"
                  placeholderTextColor={c.textMuted}
                  style={{
                    borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                    padding: spacing.md, color: c.text, backgroundColor: c.surface,
                  }}
                />
              </View>
            </View>

            <Button label="Create Course" busy={creating} onPress={submit} full />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
