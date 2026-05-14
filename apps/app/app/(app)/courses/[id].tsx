import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Pressable,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Link, useLocalSearchParams, router } from 'expo-router';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-store';
import { useColors, spacing, radius, typography } from '../../../lib/theme';
import { Button, Surface, Tag } from '../../../components/ui';

interface Course {
  id: string;
  semester: number;
  year: number;
  subject: { name: string; code: string; department: { name: string } };
  teachers: { id: string; name: string; email: string | null }[];
  _count: { enrollments: number; lectures: number; assignments: number; tests: number };
}

interface Student {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string | null };
}

interface UserResult {
  id: string;
  name: string;
  email: string | null;
  roles: { role: string }[];
}

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const c = useColors();

  const me = useAuth((s) => s.me);
  const roles = me?.roles.map((r) => r.role) ?? [];
  const canManage = roles.includes('ADMIN') || roles.includes('STAFF') || roles.includes('TEACHER');

  const loadCourse = () =>
    api<Course>(`/api/courses/${id}`).then(setCourse);

  const loadStudents = () =>
    api<Student[]>(`/api/courses/${id}/students`).then(setStudents).catch(() => {});

  useEffect(() => {
    if (!id) return;
    loadCourse();
    loadStudents();
  }, [id]);

  const search = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const r = await api<{ users: UserResult[] }>(`/api/users?q=${encodeURIComponent(searchQ)}`);
      setSearchResults(r.users);
    } finally {
      setSearching(false);
    }
  };

  const addStudent = async (userId: string) => {
    setBusy(true);
    try {
      await api(`/api/courses/${id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ studentIds: [userId] }),
      });
      setShowAddStudent(false);
      setSearchQ(''); setSearchResults([]);
      loadCourse(); loadStudents();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeStudent = (userId: string) =>
    Alert.alert('Remove student?', 'This will un-enroll them from the course.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await api(`/api/courses/${id}/enroll/${userId}`, { method: 'DELETE' }).catch((e) =>
            Alert.alert('Error', (e as Error).message),
          );
          loadCourse(); loadStudents();
        },
      },
    ]);

  const addTeacher = async (userId: string) => {
    if (!course) return;
    setBusy(true);
    try {
      const newIds = [...course.teachers.map((t) => t.id), userId];
      await api(`/api/courses/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ teacherIds: newIds }),
      });
      setShowAddTeacher(false);
      setSearchQ(''); setSearchResults([]);
      loadCourse();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeTeacher = (teacherId: string) => {
    if (!course) return;
    Alert.alert('Remove teacher?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const newIds = course.teachers.filter((t) => t.id !== teacherId).map((t) => t.id);
          await api(`/api/courses/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ teacherIds: newIds }),
          }).catch((e) => Alert.alert('Error', (e as Error).message));
          loadCourse();
        },
      },
    ]);
  };

  if (!course) return <ActivityIndicator style={{ marginTop: 32 }} />;

  const SearchModal = ({ title, onSelect, onClose }: { title: string; onSelect: (id: string) => void; onClose: () => void }) => (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typography.h2, color: c.text }}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: c.textMuted, fontSize: 16 }}>Cancel</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TextInput
              value={searchQ}
              onChangeText={setSearchQ}
              onSubmitEditing={search}
              placeholder="Search by name or email"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              style={{
                flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.md,
                padding: spacing.md, color: c.text, backgroundColor: c.surface,
              }}
            />
            <Button label="Search" busy={searching} onPress={search} />
          </View>
          {searchResults.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => onSelect(u.id)}
              disabled={busy}
              style={{ padding: spacing.md, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface }}
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>{u.name}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                {u.email} · {u.roles.map((r) => r.role).join(', ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...typography.display, color: c.text }}>{course.subject.code}</Text>
        <Text style={{ ...typography.h3, color: c.textMuted }}>{course.subject.name}</Text>
        <Text style={{ color: c.textMuted, fontSize: 13 }}>
          {course.subject.department.name} · Sem {course.semester} / {course.year}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}>
          <Tag label={`${course._count.lectures} lectures`} />
          <Tag label={`${course._count.assignments} assignments`} />
          <Tag label={`${course._count.tests} tests`} />
          <Tag label={`${course._count.enrollments} students`} />
        </View>
      </View>

      {/* Quick links */}
      <Surface>
        <Text style={{ ...typography.micro, color: c.accent }}>Go to</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button label="Lectures" variant="secondary" size="sm"
            onPress={() => router.push(`/(app)/lectures?courseId=${id}`)} />
          <Button label="Assignments" variant="secondary" size="sm"
            onPress={() => router.push(`/(app)/assignments?courseId=${id}`)} />
          <Button label="Tests" variant="secondary" size="sm"
            onPress={() => router.push(`/(app)/tests/index?courseId=${id}` as never)} />
        </View>
      </Surface>

      {/* Teachers */}
      <Surface>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...typography.micro, color: c.accent }}>Teachers</Text>
          {canManage && (
            <Pressable onPress={() => { setSearchQ(''); setSearchResults([]); setShowAddTeacher(true); }}>
              <Text style={{ color: c.primary, fontWeight: '600', fontSize: 13 }}>+ Add</Text>
            </Pressable>
          )}
        </View>
        {course.teachers.length === 0 ? (
          <Text style={{ color: c.textMuted, marginTop: spacing.sm, fontSize: 13 }}>No teachers assigned.</Text>
        ) : (
          course.teachers.map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
              <View>
                <Text style={{ color: c.text, fontWeight: '600' }}>{t.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>{t.email ?? '—'}</Text>
              </View>
              {canManage && (
                <Pressable onPress={() => removeTeacher(t.id)}>
                  <Text style={{ color: c.danger, fontSize: 13 }}>Remove</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </Surface>

      {/* Students */}
      <Surface>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...typography.micro, color: c.accent }}>Students ({students.length})</Text>
          {canManage && (
            <Pressable onPress={() => { setSearchQ(''); setSearchResults([]); setShowAddStudent(true); }}>
              <Text style={{ color: c.primary, fontWeight: '600', fontSize: 13 }}>+ Enroll</Text>
            </Pressable>
          )}
        </View>
        {students.length === 0 ? (
          <Text style={{ color: c.textMuted, marginTop: spacing.sm, fontSize: 13 }}>No students enrolled.</Text>
        ) : (
          students.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
              <View>
                <Text style={{ color: c.text, fontWeight: '600' }}>{s.user.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>{s.user.email ?? '—'}</Text>
              </View>
              {canManage && (
                <Pressable onPress={() => removeStudent(s.user.id)}>
                  <Text style={{ color: c.danger, fontSize: 13 }}>Remove</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </Surface>

      {showAddStudent && (
        <SearchModal title="Enroll student" onSelect={addStudent} onClose={() => setShowAddStudent(false)} />
      )}
      {showAddTeacher && (
        <SearchModal title="Add teacher" onSelect={addTeacher} onClose={() => setShowAddTeacher(false)} />
      )}
    </ScrollView>
  );
}
