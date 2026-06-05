import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Slot {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  course: {
    subject: { code: string; name: string };
    teachers: { id: string; name: string }[];
  };
  classroom: { name: string; building: string | null } | null;
}

export default function Timetable() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<Slot[]>('/api/timetable?mine=true')
      .then(setSlots)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  const byDay = DAYS.map((label, idx) => ({
    label,
    idx,
    slots: slots.filter((s) => s.weekday === idx).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter((d) => d.slots.length > 0);

  if (byDay.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>No classes scheduled</Text>
        <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
          Your timetable will appear here once a teacher or admin adds classes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.md }}>
      {byDay.map((day) => (
        <View key={day.idx} style={{ marginBottom: spacing.lg }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, marginBottom: spacing.sm }}>
            {day.label}
          </Text>
          {day.slots.map((slot) => (
            <View
              key={slot.id}
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                marginBottom: spacing.sm,
              }}
            >
              <View style={{ width: 52, alignItems: 'flex-end', paddingTop: 3 }}>
                <Text style={{ color: c.textMuted, fontSize: 11 }}>{slot.startTime}</Text>
                <Text style={{ color: c.textMuted, fontSize: 11 }}>{slot.endTime}</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  padding: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderLeftWidth: 3,
                  borderLeftColor: c.primary,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>
                  {slot.course.subject.code} — {slot.course.subject.name}
                </Text>
                {slot.classroom && (
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
                    {slot.classroom.name}
                    {slot.classroom.building ? ` · ${slot.classroom.building}` : ''}
                  </Text>
                )}
                {slot.course.teachers.length > 0 && (
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    {slot.course.teachers.map((t) => t.name).join(', ')}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
