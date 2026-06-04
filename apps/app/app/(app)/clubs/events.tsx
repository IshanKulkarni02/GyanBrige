import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, typography } from '../../../lib/theme';
import { Hero, Surface, Tag, Button } from '../../../components/ui';

interface Event {
  id: string;
  title: string;
  body: string | null;
  startAt: string;
  endAt: string;
  venue: string | null;
  rsvpRequired: boolean;
  capacity: number | null;
  club: { id: string; name: string };
  _count: { rsvps: number };
}

export default function ClubEvents() {
  const [rows, setRows] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.dark;

  const load = async () => {
    setRows(await api<Event[]>('/api/clubs/events'));
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const rsvp = async (id: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') => {
    try {
      await api(`/api/clubs/events/${id}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      Alert.alert('Saved', `Marked ${status}`);
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Hero eyebrow="Community" title="Club events." subtitle="RSVP and check in with NFC or QR." />
      <FlatList
        data={rows}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
        renderItem={({ item }) => (
          <Surface>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Tag label={item.club.name} tone="accent" />
              {item.rsvpRequired && <Tag label="RSVP required" tone="warning" />}
            </View>
            <Text style={{ color: c.text, ...typography.h3, marginTop: spacing.sm }}>{item.title}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              {new Date(item.startAt).toLocaleString()} · {item.venue ?? 'TBD'} · {item._count.rsvps} going
            </Text>
            {item.body && <Text style={{ color: c.text, marginTop: spacing.sm }}>{item.body}</Text>}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button label="I'm going" size="sm" onPress={() => rsvp(item.id, 'GOING')} />
              <Button label="Maybe" size="sm" variant="ghost" onPress={() => rsvp(item.id, 'MAYBE')} />
              <Button label="Can't" size="sm" variant="ghost" onPress={() => rsvp(item.id, 'NOT_GOING')} />
            </View>
          </Surface>
        )}
      />
    </View>
  );
}
