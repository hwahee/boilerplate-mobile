/**
 * Motion plumbing for skin interactions. Components never choose durations or
 * curves: they drive a 0→1 progress value and the SKIN decides how long it
 * takes and how it moves (tokens.motion) — the app's version of the web's
 * `transition: transform var(--duration-fast) var(--ease-interaction)`.
 *
 * Zero duration (office) or OS "reduce motion" jump straight to the target.
 */
import { useCallback, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { useTheme } from './ThemeProvider';

export interface MotionProgress {
  /** 0 = rest, 1 = active (pressed / focused). May overshoot past 1 (kids). */
  progress: Animated.Value;
  animateTo: (target: 0 | 1) => void;
}

/** `initial` is the value on mount (1 for something that starts active, e.g. an open panel). */
export function useMotionProgress(initial: 0 | 1 = 0): MotionProgress {
  const { tokens, reduceMotion } = useTheme();
  // Created once; lazy state (not a ref) so reading it during render is legal.
  const [progress] = useState(() => new Animated.Value(initial));
  const { durationFast, easing } = tokens.motion;

  const animateTo = useCallback(
    (target: 0 | 1) => {
      if (reduceMotion || durationFast === 0) {
        progress.setValue(target);
        return;
      }
      Animated.timing(progress, {
        toValue: target,
        duration: durationFast,
        easing: Easing.bezier(...easing),
        useNativeDriver: true,
      }).start();
    },
    [progress, reduceMotion, durationFast, easing],
  );

  return { progress, animateTo };
}
