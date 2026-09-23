/**
 * Primary interactive control. `testID` is REQUIRED (UI-automation contract,
 * docs/ui-automation.md) and must come from the TESTID registry.
 *
 * Accessibility: role=button, disabled/busy state exposed, label defaults to
 * the visible text; touch target respects the variant's minimum size (office's
 * compact 28pt buttons get the rest through hitSlop).
 *
 * Skins (theme/skin.ts): office draws a raised bevel that presses in; kids
 * sits on a sticker shadow and squishes on press.
 */
import { ActivityIndicator, Animated, Pressable } from 'react-native';

import { useMotionProgress } from '../theme/motion';
import { buttonSkin, touchSlop } from '../theme/skin';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

export interface ButtonProps {
  /** Required — from the TESTID registry only. */
  testID: string;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  /** Shows a spinner and blocks presses (e.g. while a mutation is pending). */
  loading?: boolean;
  accessibilityHint?: string;
}

export function Button({
  testID,
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
}: ButtonProps) {
  const { tokens, reduceMotion } = useTheme();
  const { colors } = tokens;
  const press = useMotionProgress();

  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    danger: { bg: colors.danger, fg: colors.onDanger, border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];

  const blocked = disabled || loading;
  // Label color/weight don't depend on the pressed state in any skin.
  const restSkin = buttonSkin(tokens, variant, { pressed: false, disabled: blocked, reduceMotion });
  const labelColor = restSkin.labelColor ?? palette.fg;
  const squishes = tokens.motion.pressScale !== 1 && !reduceMotion;

  return (
    // Kids squish: translateY(2px) scale(--press-scale), animated on the
    // skin's springy curve. Identity transform for every other skin.
    <Animated.View
      style={
        squishes
          ? {
              transform: [
                {
                  translateY: press.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 2],
                  }),
                },
                {
                  scale: press.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, tokens.motion.pressScale],
                  }),
                },
              ],
            }
          : undefined
      }
    >
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={squishes ? () => press.animateTo(1) : undefined}
        onPressOut={squishes ? () => press.animateTo(0) : undefined}
        disabled={blocked}
        hitSlop={touchSlop(tokens, tokens.controlHeight)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: blocked, busy: loading }}
        style={({ pressed }) => {
          const skin = buttonSkin(tokens, variant, { pressed, disabled: blocked, reduceMotion });
          return {
            minHeight: tokens.controlHeight,
            paddingHorizontal: tokens.controlPaddingX,
            borderRadius: tokens.radius.control,
            borderWidth: tokens.borderWidth,
            borderColor: palette.border,
            backgroundColor: palette.bg,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: tokens.spacing.sm,
            opacity: skin.opacity ?? (blocked ? 0.5 : pressed ? 0.8 : 1),
            ...skin.container,
          };
        }}
      >
        {loading ? <ActivityIndicator size="small" color={labelColor} /> : null}
        <AppText
          bold
          color={labelColor}
          style={restSkin.labelWeight ? { fontWeight: restSkin.labelWeight } : undefined}
        >
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
