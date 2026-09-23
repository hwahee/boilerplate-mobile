/**
 * Skin rules — the app's counterpart of the web's skin-scoped CSS blocks
 * (`[data-design='office'] .btn { … }` etc. in src/client/styles/main.css).
 *
 * Tokens carry VALUES; some skins also change the SHAPE of a component (the
 * office bevel, the kids sticker shadow) in ways a value can't express. Those
 * rules live here, one function per component, returning style OVERRIDES that
 * the component spreads over its base style. Designs A and B get `{}` from
 * every function, so they render exactly as before the skins existed.
 *
 * Pure (type-only react-native imports) so the rules are unit-tested with
 * `bun test` — see skin.test.ts.
 */
import type { TextStyle, ViewStyle } from 'react-native';

import type { BevelTokens, Tokens } from './tokens';

// ── color helpers (the subset of CSS color-mix the skins use) ────────────────

function parseHex(hex: string): [number, number, number] {
  const digits = hex.replace('#', '');
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((d) => d + d)
          .join('')
      : digits;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, '0');
}

/** `color-mix(in srgb, a <weightA*100>%, b)` for opaque hex colors. */
export function mixSrgb(a: string, b: string, weightA: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const mixed = ca.map((channel, i) => channel * weightA + (cb[i] ?? 0) * (1 - weightA));
  return `#${mixed.map(toHex).join('')}`;
}

/** `color-mix(in srgb, color <alpha*100>%, transparent)` → rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── office bevel ─────────────────────────────────────────────────────────────

/**
 * The era's 3D edge. Raised (buttons, panels): light top/left, dark
 * bottom/right. Sunken (inputs, a pressed button): the inverse.
 */
export function bevelBorder(bevel: BevelTokens, kind: 'raised' | 'sunken'): ViewStyle {
  const [topLeft, bottomRight] =
    kind === 'raised' ? [bevel.light, bevel.dark] : [bevel.dark, bevel.light];
  return {
    borderWidth: 1,
    borderStyle: 'solid',
    borderTopColor: topLeft,
    borderLeftColor: topLeft,
    borderBottomColor: bottomRight,
    borderRightColor: bottomRight,
  };
}

/** Vertical CSS gradient (RN ≥ 0.80 renders it natively on the New Architecture). */
function verticalGradient(top: string, bottom: string): ViewStyle {
  return { experimental_backgroundImage: `linear-gradient(${top}, ${bottom})` };
}

/** Button face gradient of office push-buttons / task-pane headers. */
function officeFace(bevel: BevelTokens): ViewStyle {
  return {
    ...verticalGradient(bevel.faceTop, bevel.faceBottom),
    backgroundColor: bevel.faceBottom,
  };
}

// ── kids sticker shadow ──────────────────────────────────────────────────────

const KIDS_BUTTON_SHADOW = '0px 5px 0px rgba(0, 0, 0, 0.18)';
const KIDS_BUTTON_SHADOW_PRESSED = '0px 1px 0px rgba(0, 0, 0, 0.18)';

// ── components ──────────────────────────────────────────────────────────────

export type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonState {
  pressed: boolean;
  disabled: boolean;
  /** OS "reduce motion" — kids gates its press squish behind it, like the web. */
  reduceMotion: boolean;
}

export interface ButtonSkin {
  container: ViewStyle;
  /** Label color override (undefined = the base kind's color). */
  labelColor?: string;
  labelWeight?: TextStyle['fontWeight'];
  /** Opacity override (undefined = the base press/disabled fade). */
  opacity?: number;
}

export function buttonSkin(tokens: Tokens, kind: ButtonKind, state: ButtonState): ButtonSkin {
  const { bevel, colors } = tokens;
  if (tokens.variant === 'office' && bevel) {
    const face: ViewStyle =
      kind === 'secondary' || kind === 'ghost'
        ? officeFace(bevel)
        : kind === 'primary'
          ? verticalGradient(mixSrgb(colors.primary, '#ffffff', 0.72), colors.primary)
          : {};
    const pressed = state.pressed && !state.disabled;
    return {
      container: {
        ...face,
        // Press in: invert the bevel and nudge the label down-right — with a
        // transform, so the box (and its neighbors) never reflow.
        ...bevelBorder(bevel, pressed ? 'sunken' : 'raised'),
        ...(pressed ? { transform: [{ translateX: 1 }, { translateY: 1 }] } : null),
      },
      labelColor: kind === 'secondary' || kind === 'ghost' ? colors.text : undefined,
      labelWeight: '400',
      // The press is shown by the bevel, not a fade. Disabled = web's .55.
      opacity: state.disabled ? 0.55 : 1,
    };
  }
  if (tokens.variant === 'kids') {
    const squish = state.pressed && !state.disabled && !state.reduceMotion;
    return {
      container:
        kind === 'ghost'
          ? {}
          : { boxShadow: squish ? KIDS_BUTTON_SHADOW_PRESSED : KIDS_BUTTON_SHADOW },
      labelWeight: '800',
      // The squish IS the press feedback; without motion keep the base fade.
      opacity: state.disabled ? 0.55 : squish ? 1 : undefined,
    };
  }
  return { container: {} };
}

export interface FieldState {
  focused: boolean;
}

export function fieldSkin(tokens: Tokens, state: FieldState): ViewStyle {
  const { bevel, colors } = tokens;
  if (tokens.variant === 'office' && bevel) {
    return {
      // Sunken input. NOTE: like the web (the office rule outranks
      // `.field__input[aria-invalid]`), the bevel also wins over the error
      // border — the error is carried by the message below the field.
      ...bevelBorder(bevel, 'sunken'),
      backgroundColor: colors.surface,
      borderRadius: 1,
      // Classic dotted Windows focus rectangle, hugging the control.
      ...(state.focused
        ? { outlineWidth: 1, outlineStyle: 'dotted', outlineColor: colors.text, outlineOffset: 1 }
        : null),
    };
  }
  if (tokens.variant === 'kids' && state.focused) {
    // Base focus ring (--focus-ring-width 4px) + the fat colorful glow.
    return {
      outlineWidth: 4,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
      boxShadow: `0px 0px 0px 5px ${withAlpha(colors.focus, 0.55)}`,
    };
  }
  return {};
}

export function cardSkin(tokens: Tokens): ViewStyle {
  if (tokens.variant === 'office' && tokens.bevel) {
    // Raised group-box panel (keeps the 1px width, recolors the edges).
    return bevelBorder(tokens.bevel, 'raised');
  }
  return tokens.surfaceShadow ? { boxShadow: tokens.surfaceShadow } : {};
}

export interface AccordionSkin {
  trigger: ViewStyle;
  /** Border color between items. */
  separatorColor: string;
  titleWeight?: TextStyle['fontWeight'];
}

export function accordionSkin(tokens: Tokens): AccordionSkin {
  if (tokens.variant === 'office' && tokens.bevel) {
    // Task-pane header bars.
    return { trigger: officeFace(tokens.bevel), separatorColor: tokens.bevel.dark };
  }
  if (tokens.variant === 'kids') {
    return { trigger: {}, separatorColor: tokens.colors.border, titleWeight: '800' };
  }
  return { trigger: {}, separatorColor: tokens.colors.border };
}

/**
 * hitSlop that grows a control whose VISIBLE height is below the touch
 * minimum (office's compact controls) back to `minTouchTarget`.
 */
export function touchSlop(tokens: Tokens, visibleHeight: number): number | undefined {
  const missing = tokens.minTouchTarget - visibleHeight;
  return missing > 0 ? Math.ceil(missing / 2) : undefined;
}
