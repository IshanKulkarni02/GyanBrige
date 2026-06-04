import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors, spacing } from '../../lib/theme';
import type { ReactNode } from 'react';

interface Props extends ScrollViewProps {
  children: ReactNode;
  scrollable?: boolean;
  padded?: boolean;
}

export function Screen({ children, scrollable = true, padded = true, style, ...rest }: Props) {
  const c = useColors();
  const Body = scrollable ? ScrollView : View;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <Body
        {...rest}
        style={[{ flex: 1, backgroundColor: c.bg }, style]}
        contentContainerStyle={
          scrollable
            ? { paddingHorizontal: padded ? spacing.lg : 0, paddingBottom: spacing.xxl, gap: spacing.lg }
            : undefined
        }
      >
        {children}
      </Body>
    </SafeAreaView>
  );
}
