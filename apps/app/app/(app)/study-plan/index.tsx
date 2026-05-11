import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { api } from '../../../lib/api';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import { Hero, Surface, Tag, Button } from '../../../components/ui';

interface Item {
  day: number;
  durationMin: number;
  task: string;
  why: string;
}

interface Plan {
  id: string;
  generatedAt: string;
  planJson: { items: Item[]; generatedFor: string };
  weakTopics: string[];
  course: { subject: { code: string; name: string } };
}

export default function StudyPlan() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.dark;

  const load = async () => {
    setRows(await api<Plan[]>('/api/study-plan/me'));
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const regen = async (courseId: string) => {
    try {
      await api('/api/study-plan/regenerate', {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      });
      setTimeout(load, 1500);
    } catch {
      /* worker queue accepted but plan needs a moment */
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero
        eyebrow="Personalized"
        title="Your study plan."
        subtitle="Weekly checklist generated from missed lectures, quiz weak spots, and flashcard misses."
      />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {rows.length === 0 ? (
          <Surface tone="alt">
            <Text style={{ color: c.text, ...typography.h3 }}>No plans yet</Text>
            <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
              Once a teacher publishes notes for a course you're in, your weekly plan will appear here.
            </Text>
          </Surface>
        ) : (
          rows.map((p) => (
            <Surface key={p.id}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ color: c.text, ...typography.h3 }}>{p.course.subject.code}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>
                    {new Date(p.generatedAt).toLocaleDateString()} · {p.planJson.items.length} tasks
                  </Text>
                </View>
                <Button label="Regenerate" variant="ghost" size="sm" onPress={() => regen(p.course.subject.code)} />
              </View>
              {p.weakTopics.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
                  {p.weakTopics.slice(0, 6).map((t, i) => (
                    <Tag key={i} label={t} tone="warning" />
                  ))}
                </View>
              )}
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {p.planJson.items.map((it, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      gap: spacing.sm,
                      paddingTop: spacing.sm,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: c.border,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: radius.sm,
                        backgroundColor: c.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: c.primaryFg, fontWeight: '700' }}>{it.day}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text }}>{it.task}</Text>
                      <Text style={{ color: c.textMuted, fontSize: 12 }}>
                        {it.durationMin} min · {it.why}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Surface>
          ))
        )}
      </View>
    </ScrollView>
  );
}
