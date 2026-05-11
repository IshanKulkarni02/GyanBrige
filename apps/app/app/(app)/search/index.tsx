// Smart search across lectures, assignments, and chat. Hybrid keyword + vector.

import { useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Hit {
  kind: string;
  id: string;
  title: string;
  snippet: string;
  deeplink: string;
}

export default function Search() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const c = colors.light;

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ results: Hit[] }>(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(r.results);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={run}
          placeholder="Search lectures, assignments, chats..."
          autoCapitalize="none"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            padding: spacing.sm,
            color: c.text,
          }}
        />
        <Pressable
          onPress={run}
          disabled={busy}
          style={{
            paddingHorizontal: spacing.md,
            justifyContent: 'center',
            backgroundColor: c.primary,
            borderRadius: radius.md,
          }}
        >
          {busy ? <ActivityIndicator color={c.primaryFg} /> : <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Find</Text>}
        </Pressable>
      </View>
      <FlatList
        data={results}
        keyExtractor={(h, i) => `${h.kind}-${h.id}-${i}`}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        renderItem={({ item }) => (
          <Link href={item.deeplink as never} asChild>
            <Pressable
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.surface,
              }}
            >
              <Text style={{ color: c.textMuted, fontSize: 11, textTransform: 'uppercase' }}>{item.kind}</Text>
              <Text style={{ color: c.text, fontWeight: '600' }}>{item.title}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>{item.snippet}</Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}
