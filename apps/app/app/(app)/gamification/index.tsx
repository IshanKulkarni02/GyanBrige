import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Me {
  stats: {
    attendance: number;
    loginStreak: number;
    assignmentsOnTime: number;
    perfectQuizzes: number;
    totalPoints: number;
  };
  badges: { code: string; label: string }[];
}

interface Leader {
  id: string;
  name: string;
  stats: { totalPoints: number; loginStreak: number };
}

export default function Gamification() {
  const [me, setMe] = useState<Me | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    Promise.all([api<Me>('/api/gamification/me'), api<Leader[]>('/api/gamification/leaderboard')])
      .then(([m, l]) => {
        setMe(m);
        setLeaders(l);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !me) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <View
        style={{
          padding: spacing.lg,
          backgroundColor: c.primary,
          borderRadius: radius.md,
          marginBottom: spacing.lg,
        }}
      >
        <Text style={{ color: c.primaryFg, fontWeight: '700', fontSize: 32 }}>
          {me.stats.totalPoints}
        </Text>
        <Text style={{ color: c.primaryFg, opacity: 0.85 }}>points</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
          <Stat label="Streak" value={`${me.stats.loginStreak}d`} c={c} />
          <Stat label="Attendance" value={String(me.stats.attendance)} c={c} />
          <Stat label="Quizzes 100%" value={String(me.stats.perfectQuizzes)} c={c} />
        </View>
      </View>

      <Text style={{ color: c.text, fontWeight: '600', marginBottom: spacing.sm }}>
        Badges ({me.badges.length})
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {me.badges.map((b) => (
          <View
            key={b.code}
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: radius.sm,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ color: c.text, fontSize: 12 }}>{b.label}</Text>
          </View>
        ))}
      </View>

      <Text style={{ color: c.text, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm }}>
        Leaderboard
      </Text>
      <FlatList
        scrollEnabled={false}
        data={leaders}
        keyExtractor={(l) => l.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
        renderItem={({ item, index }) => (
          <View
            style={{
              padding: spacing.sm,
              flexDirection: 'row',
              justifyContent: 'space-between',
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ color: c.text }}>
              {index + 1}. {item.name}
            </Text>
            <Text style={{ color: c.textMuted }}>
              {item.stats.totalPoints} · {item.stats.loginStreak}d
            </Text>
          </View>
        )}
      />
    </ScrollView>
  );
}

function Stat({ label, value, c }: { label: string; value: string; c: typeof colors.light }) {
  return (
    <View>
      <Text style={{ color: c.primaryFg, fontWeight: '700', fontSize: 18 }}>{value}</Text>
      <Text style={{ color: c.primaryFg, opacity: 0.7, fontSize: 11 }}>{label}</Text>
    </View>
  );
}
