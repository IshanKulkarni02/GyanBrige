import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Question {
  id: string;
  type: 'scale' | 'choice' | 'text';
  prompt: string;
  options?: string[];
  required: boolean;
}

interface Form {
  id: string;
  title: string;
  anonymous: boolean;
  closesAt: string;
  schema: { questions: Question[] };
}

export default function FeedbackForms() {
  const [rows, setRows] = useState<Form[]>([]);
  const [active, setActive] = useState<Form | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<Form[]>('/api/feedback/forms')
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!active) return;
    try {
      await api('/api/feedback/responses', {
        method: 'POST',
        body: JSON.stringify({ formId: active.id, answers }),
      });
      Alert.alert('Thanks');
      setActive(null);
      setAnswers({});
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  if (active) {
    return (
      <View style={{ flex: 1, padding: spacing.md, backgroundColor: c.bg }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>{active.title}</Text>
        <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
          {active.anonymous ? 'Anonymous' : 'Named'} · closes {new Date(active.closesAt).toLocaleDateString()}
        </Text>
        <FlatList
          data={active.schema.questions}
          keyExtractor={(q) => q.id}
          style={{ marginTop: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <View>
              <Text style={{ color: c.text, fontWeight: '600' }}>
                {item.prompt}
                {item.required ? ' *' : ''}
              </Text>
              {item.type === 'text' && (
                <TextInput
                  value={(answers[item.id] as string) ?? ''}
                  onChangeText={(v) => setAnswers((m) => ({ ...m, [item.id]: v }))}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: radius.md,
                    padding: spacing.sm,
                    color: c.text,
                    minHeight: 80,
                    marginTop: spacing.xs,
                  }}
                />
              )}
              {item.type === 'scale' && (
                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setAnswers((m) => ({ ...m, [item.id]: n }))}
                      style={{
                        flex: 1,
                        padding: spacing.sm,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: answers[item.id] === n ? c.primary : c.border,
                        backgroundColor: answers[item.id] === n ? c.primary : 'transparent',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: answers[item.id] === n ? c.primaryFg : c.text }}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {item.type === 'choice' &&
                item.options?.map((opt, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setAnswers((m) => ({ ...m, [item.id]: opt }))}
                    style={{
                      marginTop: spacing.xs,
                      padding: spacing.sm,
                      borderWidth: 1,
                      borderColor: answers[item.id] === opt ? c.primary : c.border,
                      borderRadius: radius.sm,
                      backgroundColor: answers[item.id] === opt ? c.primary : 'transparent',
                    }}
                  >
                    <Text style={{ color: answers[item.id] === opt ? c.primaryFg : c.text }}>{opt}</Text>
                  </Pressable>
                ))}
            </View>
          )}
        />
        <Pressable
          onPress={submit}
          style={{
            padding: spacing.md,
            backgroundColor: c.primary,
            borderRadius: radius.md,
            alignItems: 'center',
            marginTop: spacing.md,
          }}
        >
          <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Submit feedback</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(f) => f.id}
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: spacing.md }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => setActive(item)}
          style={{
            padding: spacing.md,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            backgroundColor: c.surface,
          }}
        >
          <Text style={{ color: c.text, fontWeight: '600' }}>{item.title}</Text>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>
            {item.anonymous ? '🕶 Anonymous' : '🪪 Named'} · {item.schema.questions.length} questions
          </Text>
        </Pressable>
      )}
    />
  );
}
