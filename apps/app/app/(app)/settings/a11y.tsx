import { useEffect } from 'react';
import { View, Text, Pressable, Switch, ScrollView } from 'react-native';
import { useA11y, themedColors } from '../../../lib/a11y';
import { spacing, radius } from '../../../lib/theme';

export default function A11ySettings() {
  const a = useA11y();
  const c = themedColors(a.highContrast);

  useEffect(() => {
    void a.hydrate();
  }, []);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: c.text }}>Accessibility</Text>

      <Text style={{ marginTop: spacing.lg, color: c.text, fontWeight: '600' }}>
        Font scale ({Math.round(a.fontScale * 100)}%)
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        {[0.8, 1, 1.25, 1.5, 1.75, 2].map((n) => (
          <Pressable
            key={n}
            onPress={() => a.setFontScale(n)}
            style={{
              flex: 1,
              padding: spacing.sm,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: a.fontScale === n ? c.primary : c.border,
              backgroundColor: a.fontScale === n ? c.primary : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: a.fontScale === n ? c.primaryFg : c.text }}>{Math.round(n * 100)}%</Text>
          </Pressable>
        ))}
      </View>

      <Row label="Dyslexia-friendly font" value={a.dyslexia} onChange={a.toggleDyslexia} c={c} />
      <Row label="High contrast" value={a.highContrast} onChange={a.toggleHighContrast} c={c} />
      <Row label="Reduced motion" value={a.reducedMotion} onChange={a.toggleReducedMotion} c={c} />
    </ScrollView>
  );
}

function Row({
  label,
  value,
  onChange,
  c,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  c: ReturnType<typeof themedColors>;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: c.border,
      }}
    >
      <Text style={{ color: c.text }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
