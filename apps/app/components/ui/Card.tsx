import { Pressable, View, Text, type PressableProps } from 'react-native';
import { Link } from 'expo-router';
import { useColors, radius, spacing, typography } from '../../lib/theme';
import type { ReactNode } from 'react';

interface CardProps extends Omit<PressableProps, 'children'> {
  title: string;
  description?: string;
  tag?: string;
  href?: string;
  tone?: 'default' | 'accent';
  right?: ReactNode;
  footer?: ReactNode;
}

export function Card({ title, description, tag, href, tone = 'default', right, footer, ...rest }: CardProps) {
  const c = useColors();
  const accentBg = tone === 'accent' ? c.primary : c.surface;
  const accentFg = tone === 'accent' ? c.primaryFg : c.text;
  const muted = tone === 'accent' ? (c.primaryFg === '#0E0E10' ? 'rgba(14,14,16,0.7)' : 'rgba(212,255,79,0.85)') : c.textMuted;

  const inner = (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: tone === 'accent' ? c.primary : c.border,
        backgroundColor: accentBg,
        gap: spacing.sm,
        minHeight: 140,
      }}
    >
      {tag && (
        <Text style={{ ...typography.micro, color: tone === 'accent' ? muted : c.accent }}>
          {tag}
        </Text>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ ...typography.h3, color: accentFg, flex: 1 }}>{title}</Text>
        {right}
      </View>
      {description && (
        <Text style={{ ...typography.body, color: muted }}>{description}</Text>
      )}
      {footer}
    </View>
  );

  if (href) {
    return (
      <Link href={href as never} asChild>
        <Pressable {...rest}>{inner}</Pressable>
      </Link>
    );
  }
  return <Pressable {...rest}>{inner}</Pressable>;
}
