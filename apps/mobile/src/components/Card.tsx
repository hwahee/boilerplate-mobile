/**
 * Surface container — the standard grouping block. Skins: office draws a
 * raised group-box bevel, kids a hard sticker shadow (theme/skin.ts).
 */
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { PropsWithChildren } from 'react';

import { cardSkin } from '../theme/skin';
import { useTheme } from '../theme/ThemeProvider';

export interface CardProps extends PropsWithChildren {
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({ testID, style, children }: CardProps) {
  const { tokens } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: tokens.colors.surface,
          borderRadius: tokens.radius.surface,
          borderWidth: tokens.borderWidth,
          borderColor: tokens.colors.border,
          padding: tokens.spacing.md,
          ...cardSkin(tokens),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
