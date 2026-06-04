import { View, Text } from 'react-native';
import { useColors, radius, spacing } from '../../lib/theme';

interface Props {
  label: string;
  tone?: 'default' | 'accent' | 'success' | 'danger' | 'warning';
}

export function Tag({ label, tone = 'default' }: Props) {
  const c = useColors();
  const map = {
    default: { bg: c.surfaceAlt, fg: c.textMuted, border: c.border },
    accent: { bg: 'rgba(157,122,255,0.15)', fg: c.accent, border: 'rgba(157,122,255,0.3)' },
    success: { bg: 'rgba(93,211,158,0.15)', fg: c.success, border: 'rgba(93,211,158,0.3)' },
    danger: { bg: 'rgba(255,92,92,0.15)', fg: c.danger, border: 'rgba(255,92,92,0.3)' },
    warning: { bg: 'rgba(249,180,92,0.15)', fg: c.warning, border: 'rgba(249,180,92,0.3)' },
  }[tone];
  return (
    <View
      style={{
        paddingVertical: 4,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: map.bg,
        borderColor: map.border,
        borderWidth: 1,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: map.fg, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
