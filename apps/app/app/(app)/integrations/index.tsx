import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, typography } from '../../../lib/theme';
import { Hero, Surface, Button, Tag } from '../../../components/ui';

interface Status {
  connected: boolean;
  clientId: string | null;
}

export default function Integrations() {
  const [google, setGoogle] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const c = colors.dark;

  const load = async () => {
    setGoogle(await api<Status>('/api/integrations/google/status'));
  };
  useEffect(() => {
    void load();
  }, []);

  const sync = async () => {
    setBusy(true);
    try {
      const r = await api<{ pushed: number; total: number }>('/api/integrations/google/sync-calendar', {
        method: 'POST',
      });
      Alert.alert('Synced', `Pushed ${r.pushed} of ${r.total} events`);
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero eyebrow="External" title="Integrations." subtitle="Push lectures to your calendar of choice." />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Surface>
          <Tag label="Google Calendar" tone="accent" />
          <Text style={{ ...typography.h3, color: c.text, marginTop: spacing.sm }}>
            {google?.connected ? 'Connected.' : 'Not connected.'}
          </Text>
          <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
            {google?.clientId
              ? 'Admin has configured a Google client. Connect to push your timetable into your calendar.'
              : 'Admin has not configured Google credentials yet — ask them to set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button label={google?.connected ? 'Sync 30 lectures' : 'Connect'} onPress={sync} busy={busy} disabled={!google?.connected} />
          </View>
        </Surface>
      </View>
    </ScrollView>
  );
}
