import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Suggestion {
  mentorId: string;
  mentorName: string;
  sharedCourseIds: string[];
  score: number;
}

export default function Mentors() {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<{ matches: Suggestion[] }>('/api/mentors/suggestions')
      .then((r) => setRows(r.matches))
      .finally(() => setLoading(false));
  }, []);

  const request = async (mentorId: string) => {
    try {
      await api('/api/mentors/request', {
        method: 'POST',
        body: JSON.stringify({ mentorId, note: 'Would love your guidance.' }),
      });
      Alert.alert('Sent', 'Mentor request submitted.');
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <FlatList
      data={rows}
      keyExtractor={(s) => s.mentorId}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      renderItem={({ item }) => (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
          }}
        >
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
      )}
    />
  );
}
