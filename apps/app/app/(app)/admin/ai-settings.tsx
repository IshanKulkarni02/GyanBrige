import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, TextInput } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface AiConfig {
  useLocalAI: boolean;
  openai: { model: string; configured: boolean };
  ollama: { baseUrl: string; model: string };
}

interface TestResult {
  success: boolean;
  backend?: string;
  model?: string;
  response?: string;
  error?: string;
}

export default function AdminAiSettings() {
  const [cfg, setCfg] = useState<AiConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [openaiModel, setOpenaiModel] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [test, setTest] = useState<TestResult | null>(null);
  const c = colors.light;

  const load = async () => {
    const r = await api<{ config: AiConfig }>('/api/admin/ai-settings');
    setCfg(r.config);
    setOpenaiModel(r.config.openai.model);
    setOllamaModel(r.config.ollama.model);
  };
  useEffect(() => {
    void load();
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      await api('/api/admin/ai-settings/toggle', { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api('/api/admin/ai-settings', {
        method: 'PUT',
        body: JSON.stringify({ openaiModel, ollamaModel }),
      });
      Alert.alert('Saved');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (backend?: 'openai' | 'ollama') => {
    setBusy(true);
    try {
      setTest(
        await api<TestResult>('/api/admin/ai-settings/test', {
          method: 'POST',
          body: JSON.stringify(backend ? { backend } : {}),
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!cfg) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <View style={{ flex: 1, padding: spacing.lg, backgroundColor: c.bg }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>AI Backend</Text>
      <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
        Notes generator currently uses:{' '}
        <Text style={{ color: c.text, fontWeight: '600' }}>
          {cfg.useLocalAI ? 'Ollama (local)' : 'OpenAI ChatGPT'}
        </Text>
      </Text>

      <Pressable
        onPress={toggle}
        disabled={busy}
        style={{
          marginTop: spacing.md,
          padding: spacing.md,
          alignItems: 'center',
          backgroundColor: c.primary,
          borderRadius: radius.md,
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Text style={{ color: c.primaryFg, fontWeight: '600' }}>
          Switch to {cfg.useLocalAI ? 'OpenAI' : 'Ollama'}
        </Text>
      </Pressable>

      <Text style={{ marginTop: spacing.lg, color: c.text, fontWeight: '600' }}>OpenAI model</Text>
      <TextInput
        value={openaiModel}
        onChangeText={setOpenaiModel}
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          padding: spacing.sm,
          color: c.text,
          marginTop: spacing.xs,
        }}
      />
      <Text style={{ marginTop: spacing.md, color: c.text, fontWeight: '600' }}>Ollama model</Text>
      <TextInput
        value={ollamaModel}
        onChangeText={setOllamaModel}
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          padding: spacing.sm,
          color: c.text,
          marginTop: spacing.xs,
        }}
      />
      <Pressable
        onPress={save}
        disabled={busy}
        style={{
          marginTop: spacing.md,
          padding: spacing.md,
          alignItems: 'center',
          borderColor: c.primary,
          borderWidth: 1,
          borderRadius: radius.md,
        }}
      >
        <Text style={{ color: c.primary, fontWeight: '600' }}>Save model names</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Pressable
          onPress={() => runTest('openai')}
          disabled={busy}
          style={{
            flex: 1,
            padding: spacing.sm,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: c.text }}>Test OpenAI</Text>
        </Pressable>
        <Pressable
          onPress={() => runTest('ollama')}
          disabled={busy}
          style={{
            flex: 1,
            padding: spacing.sm,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: c.text }}>Test Ollama</Text>
        </Pressable>
      </View>
      {test && (
        <View
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: test.success ? '#dcfce7' : '#fee2e2',
          }}
        >
          <Text style={{ color: c.text }}>
            {test.success ? '✓' : '✗'} {test.backend} · {test.model ?? ''}
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
            {test.response ?? test.error}
          </Text>
        </View>
      )}
    </View>
  );
}
