import { Pressable, Text, ActivityIndicator, type PressableProps } from 'react-native';
import { useColors, radius, spacing } from '../../lib/theme';

interface Props extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  busy?: boolean;
  full?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  busy,
  full,
  disabled,
  style,
  ...rest
}: Props) {
  const c = useColors();
  const pad = size === 'sm' ? spacing.sm : size === 'lg' ? spacing.md + 4 : spacing.md;
  const colorMap = {
    primary: { bg: c.primary, fg: c.primaryFg, border: c.primary },
    secondary: { bg: c.surface, fg: c.text, border: c.border },
    ghost: { bg: 'transparent', fg: c.text, border: c.border },
    danger: { bg: c.danger, fg: '#fff', border: c.danger },
  }[variant];
  return (
    <Pressable
      {...rest}
      disabled={disabled || busy}
      style={({ pressed }) => [
        {
          backgroundColor: colorMap.bg,
          paddingVertical: pad,
          paddingHorizontal: pad + spacing.sm,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colorMap.border,
          alignItems: 'center',
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
        },
        typeof style === 'function' ? null : style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colorMap.fg} size="small" />
      ) : (
        <Text style={{ color: colorMap.fg, fontWeight: '600', fontSize: size === 'sm' ? 13 : 15 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
