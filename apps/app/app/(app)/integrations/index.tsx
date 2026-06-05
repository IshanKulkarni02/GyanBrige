import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Alert, Platform } from 'react-native';
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

  const load = useCallback(async () => {
    setGoogle(await api<Status>('/api/integrations/google/status'));
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Listen for the OAuth popup postMessage on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'google-oauth') {
        void load();
        if (!e.data.success) Alert.alert('Google sign-in failed', 'Please try again.');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>('/api/integrations/google/auth-url');
      if (Platform.OS === 'web') {
        // Open a 600×700 popup so the OAuth page doesn't navigate away from the app
        const popup = window.open(url, 'google-oauth', 'width=600,height=700,left=200,top=100');
        if (!popup) {
          Alert.alert('Popup blocked', 'Allow popups for this site and try again.');
        }
        // The popup posts a message on close (see backend closePopupHtml)
      } else {
        // On mobile, open in system browser and rely on deep-link back
        const { Linking } = await import('react-native');
        await Linking.openURL(url);
      }
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

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

  const noCredentials = google && !google.clientId;

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
            {noCredentials
              ? 'Admin has not configured Google credentials yet — ask them to set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + API_URL.'
              : google?.connected
              ? 'Push your upcoming lectures and assignments to Google Calendar.'
              : 'Sign in with Google to sync your timetable to Google Calendar.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            {google?.connected ? (
              <Button label="Sync 30 lectures" onPress={sync} busy={busy} />
            ) : (
              <Button label="Connect Google Calendar" onPress={connect} busy={busy} disabled={noCredentials ?? false} />
            )}
          </View>
        </Surface>
      </View>
    </ScrollView>
  );
}
