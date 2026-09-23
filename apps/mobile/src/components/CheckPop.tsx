/**
 * Wraps a checkbox glyph and, in skins that celebrate (kids), pops it when it
 * becomes checked — the app's `kids-check-pop` keyframes:
 * scale 1 → 1.5 (-12°) → 0.85 (6°) → 1 over 400ms on the skin's curve.
 * Renders its child untouched everywhere else (and under OS reduce motion).
 */
import { useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { Animated, Easing } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

const POP_DURATION_MS = 400;

export function CheckPop({ checked, children }: PropsWithChildren<{ checked: boolean }>) {
  const { tokens, reduceMotion } = useTheme();
  const [pop] = useState(() => new Animated.Value(1));
  const wasChecked = useRef(checked);
  const enabled = tokens.motion.checkPop && !reduceMotion;
  const { easing } = tokens.motion;

  useEffect(() => {
    // Only the unchecked → checked transition celebrates (not mount/uncheck).
    if (enabled && checked && !wasChecked.current) {
      pop.setValue(0);
      Animated.timing(pop, {
        toValue: 1,
        duration: POP_DURATION_MS,
        easing: Easing.bezier(...easing),
        useNativeDriver: true,
      }).start();
    }
    wasChecked.current = checked;
  }, [checked, enabled, easing, pop]);

  if (!enabled) return children;
  const keyframes = { inputRange: [0, 0.4, 0.7, 1], extrapolate: 'clamp' as const };
  return (
    <Animated.View
      style={{
        transform: [
          { scale: pop.interpolate({ ...keyframes, outputRange: [1, 1.5, 0.85, 1] }) },
          {
            rotate: pop.interpolate({
              ...keyframes,
              outputRange: ['0deg', '-12deg', '6deg', '0deg'],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
