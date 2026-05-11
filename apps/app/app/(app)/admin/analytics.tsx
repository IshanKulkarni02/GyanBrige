import { useEffect, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, typography } from '../../../lib/theme';
import { Hero, Surface, Tag, Button } from '../../../components/ui';

interface Summary {
  enrolled: number;
  lectures: number;
  attendanceCount: number;
  attendanceRatio: number;
  assignmentsDone: number;
}

export default function CourseAnalytics() {
  const [courseId, setCourseId] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const c = colors.dark;

  const load = async () => {
    if (!courseId) return;
    setBusy(true);
    try {
      setSummary(await api<Summary>(`/api/analytics/course/${courseId}/summary`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero eyebrow="Insights" title="Course analytics." subtitle="Engagement summary, attendance ratio, submissions." />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            placeholder="Course ID"
            placeholderTextColor={c.textSubtle}
            value={courseId}
            onChangeText={setCourseId}
            autoCapitalize="none"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              borderRadius: 999,
              paddingHorizontal: spacing.md,
              color: c.text,
            }}
          />
          <Button label="Load" onPress={load} busy={busy} />
        </View>

        {summary && (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
              {[
                { label: 'Enrolled', value: summary.enrolled },
                { label: 'Lectures', value: summary.lectures },
                { label: 'Attendance ratio', value: `${(summary.attendanceRatio * 100).toFixed(0)}%` },
                { label: 'Submissions', value: summary.assignmentsDone },
              ].map((s) => (
                <Surface key={s.label} tone="alt" style={{ flex: 1, minWidth: 140 }}>
                  <Tag label={s.label} />
                  <Text style={{ ...typography.display, color: c.text, fontSize: 32, marginTop: spacing.sm }}>
                    {s.value}
                  </Text>
                </Surface>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
