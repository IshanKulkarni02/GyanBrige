import { View, type ViewProps } from 'react-native';
import { useColors, radius, spacing } from '../../lib/theme';

interface Props extends ViewProps {
  tone?: 'default' | 'alt' | 'inverted';
  padded?: boolean;
}

export function Surface({ tone = 'default', padded = true, style, ...rest }: Props) {
  const c = useColors();
  const bg = tone === 'alt' ? c.surfaceAlt : tone === 'inverted' ? c.text : c.surface;
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          padding: padded ? spacing.lg : 0,
        },
        style,
      ]}
    />
  );
}
