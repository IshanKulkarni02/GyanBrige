import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing } from '../../../lib/theme';

interface Course {
  id: string;
  semester: number;
  year: number;
  subject: { name: string; code: string; department: { name: string } };
  teachers: { id: string; name: string; email: string | null }[];
  _count: { enrollments: number; lectures: number; assignments: number; tests: number };
}

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const c = colors.light;

  useEffect(() => {
    if (!id) return;
    api<Course>(`/api/courses/${id}`).then(setCourse);
  }, [id]);

  if (!course) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <View style={{ flex: 1, padding: spacing.lg, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>
        {course.subject.code} · {course.subject.name}
      </Text>
      <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
        {course.subject.department.name} · Sem {course.semester} / {course.year}
      </Text>
      <Text style={{ color: c.textMuted, marginTop: spacing.md }}>
        Teachers: {course.teachers.map((t) => t.name).join(', ') || '—'}
      </Text>
      <Text style={{ color: c.textMuted, marginTop: spacing.md }}>
        {course._count.enrollments} students · {course._count.lectures} lectures ·{' '}
        {course._count.assignments} assignments · {course._count.tests} tests
      </Text>
    </View>
  );
}
