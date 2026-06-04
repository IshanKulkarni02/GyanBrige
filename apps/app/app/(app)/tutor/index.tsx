// AI Tutor: ask a question, get an answer with citations linking to lecture
// timestamps. Retrieval is server-scoped to courses you're enrolled in.

import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Citation {
  n: number;
  lectureId: string;
  startSec: number;
  endSec: number;
  snippet: string;
}

interface Answer {
  question: string;
  answer: string;
  citations: Citation[];
}

export default function Tutor() {
  const [q, setQ] = useState('');
  const [a, setA] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const c = colors.light;

  const ask = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setA(
        await api<Answer>('/api/ai-tutor/ask', {
          method: 'POST',
          body: JSON.stringify({ question: q }),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>AI Tutor</Text>
      <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
        Ask anything about your lectures. Answers cite back to the exact moment in a recording.
      </Text>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="e.g. Explain again what mitochondria do in lecture 4"
        multiline
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          padding: spacing.sm,
          color: c.text,
          minHeight: 80,
          marginTop: spacing.md,
          textAlignVertical: 'top',
        }}
      />
      <Pressable
        onPress={ask}
        disabled={busy}
        style={{
          marginTop: spacing.sm,
          padding: spacing.md,
          backgroundColor: c.primary,
          borderRadius: radius.md,
          alignItems: 'center',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? <ActivityIndicator color={c.primaryFg} /> : <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Ask</Text>}
      </Pressable>

      {a && (
        <View
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Text style={{ color: c.text, lineHeight: 22 }}>{a.answer}</Text>
          {a.citations.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '600' }}>SOURCES</Text>
              {a.citations.map((cit) => (
                <Link
                  key={cit.n}
                  href={`/(app)/lectures/${cit.lectureId}?t=${Math.floor(cit.startSec)}`}
                  asChild
                >
                  <Pressable style={{ marginTop: spacing.sm }}>
                    <Text style={{ color: c.primary, fontSize: 12 }}>
                      [{cit.n}] Lec {cit.lectureId.slice(0, 6)} · {Math.floor(cit.startSec)}s
                    </Text>
                    <Text style={{ color: c.textMuted, fontSize: 11, fontStyle: 'italic' }}>
                      “{cit.snippet}...”
                    </Text>
                  </Pressable>
                </Link>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
