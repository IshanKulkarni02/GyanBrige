import { View, Text } from 'react-native';
import { useColors, spacing, typography } from '../../lib/theme';
import type { ReactNode } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function Hero({ eyebrow, title, subtitle, right }: Props) {
  const c = useColors();
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: spacing.lg,
      }}
    >
      <View style={{ flex: 1, gap: spacing.sm }}>
        {eyebrow && <Text style={{ ...typography.micro, color: c.accent }}>{eyebrow}</Text>}
        <Text style={{ ...typography.display, color: c.text }}>{title}</Text>
        {subtitle && (
          <Text style={{ ...typography.body, color: c.textMuted, maxWidth: 520 }}>{subtitle}</Text>
        )}
      </View>
      {right}
    </View>
  );
}
