import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Suggestion {
  mentorId: string;
  mentorName: string;
  sharedCourseIds: string[];
  score: number;
}

interface MentorRelation {
  id: string;
  status: string;
  mentor: { id: string; name: string };
  note: string | null;
  createdAt: string;
}

export default function Mentors() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [inbox, setInbox] = useState<MentorRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  const load = async () => {
    const [sugg, inc] = await Promise.all([
      api<{ matches: Suggestion[] }>('/api/mentors/suggestions').then((r) => r.matches),
      api<MentorRelation[]>('/api/mentors/inbox').catch(() => [] as MentorRelation[]),
    ]);
    setSuggestions(sugg);
    setInbox(inc);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const request = async (mentorId: string) => {
    try {
      await api('/api/mentors/request', {
        method: 'POST',
        body: JSON.stringify({ mentorId, note: 'Would love your guidance.' }),
      });
      Alert.alert('Sent', 'Mentor request submitted.');
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    }
  };

  const decide = async (id: string, accept: boolean) => {
    try {
      await api(`/api/mentors/inbox/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ accept }),
      });
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  const pending = inbox.filter((r) => r.status === 'PENDING');
  const active = inbox.filter((r) => r.status === 'ACCEPTED');

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      {pending.length > 0 && (
        <Section title={`Pending requests (${pending.length})`} c={c}>
          {pending.map((r) => (
            <View key={r.id} style={[card(c), { marginBottom: spacing.sm }]}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{r.mentor.name}</Text>
              {r.note && <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>{r.note}</Text>}
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <Chip label="Accept" color={c.success} onPress={() => decide(r.id, true)} />
                <Chip label="Decline" color={c.danger} onPress={() => decide(r.id, false)} />
              </View>
            </View>
          ))}
        </Section>
      )}

      {active.length > 0 && (
        <Section title={`Active mentors (${active.length})`} c={c}>
          {active.map((r) => (
            <View key={r.id} style={[card(c), { marginBottom: spacing.sm }]}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{r.mentor.name}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                Since {new Date(r.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </Section>
      )}

      <Section title="Suggested mentors" c={c}>
        {suggestions.length === 0 ? (
          <Text style={{ color: c.textMuted }}>No suggestions yet.</Text>
        ) : (
          suggestions.map((item) => (
            <View key={item.mentorId} style={[card(c), { marginBottom: spacing.sm }]}>
              <Text style={{ color: c.text, fontWeight: '600' }}>{item.mentorName}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
                {item.sharedCourseIds.length} shared courses · match {item.score}
              </Text>
              <Pressable
                onPress={() => request(item.mentorId)}
                style={{
                  marginTop: spacing.sm,
                  alignSelf: 'flex-start',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.sm,
                  backgroundColor: c.primary,
                }}
              >
                <Text style={{ color: c.primaryFg, fontWeight: '600', fontSize: 12 }}>Request mentor</Text>
              </Pressable>
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children, c }: { title: string; children: React.ReactNode; c: typeof colors.light }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: c.text, fontWeight: '700', marginBottom: spacing.sm }}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: color }}
    >
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function card(c: typeof colors.light) {
  return {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  } as const;
}
