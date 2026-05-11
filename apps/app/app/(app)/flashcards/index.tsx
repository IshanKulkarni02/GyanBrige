// Spaced-repetition review session. Pulls cards due now, lets student grade
// each 0-5; SM-2 reschedules them server-side.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Due {
  cardId: string;
  card: {
    id: string;
    front: string;
    back: string;
    lecture: { title: string };
  };
}

export default function FlashcardReview() {
  const [due, setDue] = useState<Due[]>([]);
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<Due[]>('/api/flashcards/due')
      .then(setDue)
      .finally(() => setLoading(false));
  }, []);

  const grade = async (quality: number) => {
    const card = due[idx];
    if (!card) return;
    setBusy(true);
    try {
      await api('/api/flashcards/review', {
        method: 'POST',
        body: JSON.stringify({ cardId: card.cardId, quality }),
      });
      setShow(false);
      setIdx((i) => i + 1);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (due.length === 0 || idx >= due.length) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>All caught up</Text>
        <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>No flashcards due right now.</Text>
      </View>
    );
  }

  const card = due[idx]!;
  return (
    <View style={{ flex: 1, padding: spacing.lg, backgroundColor: c.bg }}>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>
        {idx + 1} / {due.length} · {card.card.lecture.title}
      </Text>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        }}
      >
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '600', textAlign: 'center' }}>
          {card.card.front}
        </Text>
        {show && (
          <View style={{ marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.border, width: '100%' }}>
            <Text style={{ color: c.text, fontSize: 18, textAlign: 'center' }}>{card.card.back}</Text>
          </View>
        )}
      </View>
      {!show ? (
        <Pressable
          onPress={() => setShow(true)}
          style={{ padding: spacing.md, backgroundColor: c.primary, borderRadius: radius.md, alignItems: 'center' }}
        >
          <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Show answer</Text>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {[0, 1, 2, 3, 4, 5].map((q) => (
            <Pressable
              key={q}
              onPress={() => grade(q)}
              disabled={busy}
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radius.sm,
                alignItems: 'center',
                backgroundColor:
                  q < 3 ? c.danger : q < 4 ? c.textMuted : c.success,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{q}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
