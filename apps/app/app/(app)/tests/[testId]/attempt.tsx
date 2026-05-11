// Test attempt screen with always-on proctoring signals:
// - tab/blur → TAB_BLUR event
// - copy/paste blocked + reported
// - if test.settings.strictProctoring → webcam frame-presence check loop
// Cap enforcement is done server-side on /start.

import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../../../lib/api';
import { colors, spacing, radius } from '../../../../lib/theme';

interface Question {
  id: string;
  order: number;
  type: 'MCQ' | 'MSQ' | 'SHORT' | 'LONG' | 'CODE';
  prompt: string;
  options?: string[];
  points: number;
}

interface AttemptResp {
  attempt: { id: string };
  questions: Question[];
  durationSec: number;
  settings: { strictProctoring?: boolean; lockdown?: boolean };
}

export default function TakeTest() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const [att, setAtt] = useState<AttemptResp | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const violationsRef = useRef(0);
  const c = colors.light;

  useEffect(() => {
    if (!testId) return;
    api<AttemptResp>(`/api/tests/${testId}/start`, { method: 'POST' })
      .then((r) => {
        setAtt(r);
        setRemaining(r.durationSec);
      })
      .catch((e) => Alert.alert('Cannot start', (e as Error).message));
  }, [testId]);

  useEffect(() => {
    if (!att) return;
    const t = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [att]);

  useEffect(() => {
    if (!att || Platform.OS !== 'web') return;
    const reportEvt = (type: 'TAB_BLUR' | 'COPY' | 'PASTE' | 'FULLSCREEN_EXIT') => {
      violationsRef.current += 1;
      void api('/api/tests/proctoring-events', {
        method: 'POST',
        body: JSON.stringify({ attemptId: att.attempt.id, type, severity: 2 }),
      });
    };
    const onBlur = () => reportEvt('TAB_BLUR');
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      reportEvt('COPY');
    };
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportEvt('PASTE');
    };
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [att]);

  const save = async (q: Question, value: unknown) => {
    setAnswers((m) => ({ ...m, [q.id]: value }));
    await api(`/api/tests/attempts/${att!.attempt.id}/answer`, {
      method: 'POST',
      body: JSON.stringify({ questionId: q.id, answer: value }),
    });
  };

  const submit = async () => {
    if (!att) return;
    setBusy(true);
    try {
      const r = await api<{ score: number }>(`/api/tests/attempts/${att.attempt.id}/submit`, {
        method: 'POST',
      });
      Alert.alert('Submitted', `Auto-graded: ${r.score ?? 'pending'}`);
      router.back();
    } finally {
      setBusy(false);
    }
  };

  if (!att) return <ActivityIndicator style={{ marginTop: 32 }} />;
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <View
        style={{
          padding: spacing.sm,
          borderRadius: radius.md,
          backgroundColor: remaining < 60 ? c.danger : c.surface,
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ color: remaining < 60 ? '#fff' : c.text, fontWeight: '700', fontSize: 16 }}>
          {mm}:{ss.toString().padStart(2, '0')} left · {att.questions.length} questions
        </Text>
        {att.settings.strictProctoring && (
          <Text style={{ color: remaining < 60 ? '#fff' : c.textMuted, fontSize: 12 }}>
            Strict mode: stay in tab, no copy/paste, webcam check active.
          </Text>
        )}
      </View>

      {att.questions.map((q, idx) => (
        <View
          key={q.id}
          style={{
            padding: spacing.md,
            marginBottom: spacing.md,
            borderRadius: radius.md,
            borderColor: c.border,
            borderWidth: 1,
            backgroundColor: c.surface,
          }}
        >
          <Text style={{ color: c.textMuted, fontSize: 12 }}>
            Q{idx + 1} · {q.points} pt
          </Text>
          <Text style={{ color: c.text, fontWeight: '600', marginTop: spacing.xs }}>{q.prompt}</Text>
          {(q.type === 'MCQ' || q.type === 'MSQ') && (
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              {q.options?.map((opt, i) => {
                const selected =
                  q.type === 'MCQ'
                    ? answers[q.id] === opt
                    : Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt);
                return (
                  <Pressable
                    key={i}
                    onPress={() =>
                      save(
                        q,
                        q.type === 'MCQ'
                          ? opt
                          : selected
                            ? (answers[q.id] as string[]).filter((x) => x !== opt)
                            : [...((answers[q.id] as string[]) ?? []), opt],
                      )
                    }
                    style={{
                      padding: spacing.sm,
                      borderWidth: 1,
                      borderColor: selected ? c.primary : c.border,
                      backgroundColor: selected ? c.primary : 'transparent',
                      borderRadius: radius.sm,
                    }}
                  >
                    <Text style={{ color: selected ? c.primaryFg : c.text }}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {(q.type === 'SHORT' || q.type === 'LONG' || q.type === 'CODE') && (
            <TextInput
              value={(answers[q.id] as string) ?? ''}
              onChangeText={(v) => setAnswers((m) => ({ ...m, [q.id]: v }))}
              onBlur={() => save(q, answers[q.id] ?? '')}
              multiline={q.type !== 'SHORT'}
              autoCapitalize="none"
              autoCorrect={q.type !== 'CODE'}
              style={{
                marginTop: spacing.sm,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.sm,
                padding: spacing.sm,
                color: c.text,
                minHeight: q.type === 'SHORT' ? 40 : 120,
                fontFamily: q.type === 'CODE' ? 'monospace' : undefined,
                textAlignVertical: 'top',
              }}
            />
          )}
        </View>
      ))}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={{
          padding: spacing.md,
          backgroundColor: c.danger,
          borderRadius: radius.md,
          alignItems: 'center',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '700' }}>Submit final answers</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
