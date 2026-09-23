/**
 * Theme context: color scheme (system-following + manual override) × design
 * variant (A aesthetic / B high-visibility / office / kids), both persisted.
 * One hook:
 *
 *   const { tokens, reduceMotion } = useTheme();
 *
 * `reduceMotion` mirrors the OS accessibility setting (the app's
 * `prefers-reduced-motion`): skins may animate only when it is false.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';

import { KV_KEYS, kvStore } from '../storage/kv-store';
import {
  getTokens,
  isDesignVariant,
  type ColorSchemeName,
  type DesignVariant,
  type Tokens,
} from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  tokens: Tokens;
  /** Resolved scheme after applying the mode (what is actually rendered). */
  scheme: ColorSchemeName;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  variant: DesignVariant;
  setVariant: (variant: DesignVariant) => void;
  /** OS "reduce motion" is on — skip transform/expand animations. */
  reduceMotion: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

export function ThemeProvider({ children }: PropsWithChildren) {
  const deviceScheme = useColorScheme(); // re-renders on device theme change
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [variant, setVariantState] = useState<DesignVariant>('a');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void kvStore.getString(KV_KEYS.themeMode).then((stored) => {
      if (THEME_MODES.includes(stored as ThemeMode)) setModeState(stored as ThemeMode);
    });
    void kvStore.getString(KV_KEYS.designVariant).then((stored) => {
      if (isDesignVariant(stored)) setVariantState(stored);
    });
  }, []);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void kvStore.setString(KV_KEYS.themeMode, next);
  }, []);

  const setVariant = useCallback((next: DesignVariant) => {
    setVariantState(next);
    void kvStore.setString(KV_KEYS.designVariant, next);
  }, []);

  // Derived, not stored: the rendered scheme follows mode + device setting.
  const scheme: ColorSchemeName = mode === 'system' ? (deviceScheme ?? 'light') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      tokens: getTokens(variant, scheme, Platform.OS === 'android' ? 'android' : 'ios'),
      scheme,
      mode,
      setMode,
      variant,
      setVariant,
      reduceMotion,
    }),
    [scheme, mode, setMode, variant, setVariant, reduceMotion],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within <ThemeProvider>');
  return context;
}
