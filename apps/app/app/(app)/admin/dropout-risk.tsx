import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Row {
  studentId: string;
  score: number;
  computedAt: string;
  user: { name: string; email: string | null };
  factors: {
    attendanceRatio: number;
    assignmentMissed: number;
    assignmentLate: number;
    quizSlope: number;
    loginDays: number;
  };
}

export default function DropoutRisk() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<Row[]>('/api/analytics/dropout-risk')
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.studentId}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      renderItem={({ item }) => {
        const color = item.score > 0.7 ? c.danger : item.score > 0.4 ? '#f59e0b' : c.success;
        return (
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              borderLeftWidth: 4,
              borderLeftColor: color,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{item.user?.name ?? item.studentId}</Text>
              <Text style={{ color, fontWeight: '700' }}>{(item.score * 100).toFixed(0)}%</Text>
            </View>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              Attendance {(item.factors.attendanceRatio * 100).toFixed(0)}% · Missed{' '}
              {(item.factors.assignmentMissed * 100).toFixed(0)}% · Late{' '}
              {(item.factors.assignmentLate * 100).toFixed(0)}% · Last seen {item.factors.loginDays}d ago
            </Text>
          </View>
        );
      }}
    />
  );
}
