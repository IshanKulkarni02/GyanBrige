import { View, Text, ScrollView, Pressable } from 'react-native';
import { useColors, spacing, radius, typography } from '../../../lib/theme';
import { useTheme, type ThemeMode } from '../../../lib/theme-store';
import { Hero, Surface, Tag } from '../../../components/ui';

const OPTIONS: { mode: ThemeMode; label: string; desc: string }[] = [
  { mode: 'dark', label: 'Dark', desc: 'Ink + lime. The default look.' },
  { mode: 'light', label: 'Light', desc: 'Off-white + ink. Better outside or for reading-heavy days.' },
  { mode: 'system', label: 'System', desc: 'Follow your OS. Switches with day/night settings.' },
];

export default function Appearance() {
  const c = useColors();
  const { mode, setMode } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero
        eyebrow="Preferences"
        title="Appearance."
        subtitle="Dark, light, or follow the system. The choice persists per device."
      />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        {OPTIONS.map((o) => {
          const active = mode === o.mode;
          return (
            <Pressable key={o.mode} onPress={() => setMode(o.mode)}>
              <Surface tone={active ? 'alt' : 'default'} style={{ borderColor: active ? c.primary : c.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                      <Text style={{ ...typography.h3, color: c.text }}>{o.label}</Text>
                      {active && <Tag label="Active" tone="accent" />}
                    </View>
                    <Text style={{ color: c.textMuted }}>{o.desc}</Text>
                  </View>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: active ? c.primary : c.border,
                      backgroundColor: active ? c.primary : 'transparent',
                    }}
                  />
                </View>
              </Surface>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
