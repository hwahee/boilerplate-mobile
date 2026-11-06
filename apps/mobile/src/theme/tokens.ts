/**
 * Design tokens — the single source of every color/space/type value in the
 * app. Components consume tokens via `useTheme()`; no component hardcodes a
 * color or font size.
 *
 * Two orthogonal axes, both switchable at runtime in Settings:
 *   - color scheme: light / dark (follows the device by default)
 *   - design variant (the web's skin names, upstream #28):
 *       standard — the default: soft neutrals, indigo accent, generous radii
 *       contrast — standard's shape with high-contrast colors and thicker
 *                  lines (border 2) — formerly B, which also had bigger type
 *                  and controls; upstream dropped those, and so does the app
 *       office — 2000s MS Office: dense, beveled, square, motionless
 *       kids   — playground/toy (BETA on mobile): chunky, pill-shaped, bouncy
 *
 * office and kids are PORTS of the web skins (src/client/styles/tokens.css):
 * their values are copied verbatim (1rem = 16pt) rather than re-designed, so
 * the same skin reads the same on both surfaces. standard and contrast predate that and keep
 * their mobile-specific values. See docs/design-skins-mobile.md.
 */

import { designFrom, type Design } from '@shared/domain/appearance';

export type ColorSchemeName = 'light' | 'dark';
/** The web's skin names, shared through @shared/domain/appearance. */
export type DesignVariant = Design;

/** Every variant, in the order Settings lists them. */
export const DESIGN_VARIANTS: readonly DesignVariant[] = ['standard', 'contrast', 'office', 'kids'];

export function isDesignVariant(value: unknown): value is DesignVariant {
  return DESIGN_VARIANTS.includes(value as DesignVariant);
}

/**
 * A stored choice → its variant. Choices saved before the rename (`a`, `b`)
 * read as `standard` / `contrast` — the same compatibility the web keeps
 * (`designFrom`, upstream #28); the next save writes the new name.
 */
export function designVariantFrom(stored: string | null): DesignVariant | undefined {
  return designFrom(stored);
}

/** @public part of the Tokens contract */
export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  border: string;
  danger: string;
  onDanger: string;
  success: string;
  warning: string;
  /** Focus indication (text field focus ring). */
  focus: string;
  /** Scrim behind modals/boot overlays. */
  overlay: string;
}

/** @public part of the Tokens contract */
export interface TypeScale {
  title: number;
  heading: number;
  body: number;
  caption: number;
  /** Weight used for emphasized text ('600' | '700' …). */
  emphasis: '600' | '700' | '800';
  /** Font family; undefined = the platform system font. */
  fontFamily: string | undefined;
  /**
   * Line height as a multiple of the font size (CSS `line-height`), or null to
   * leave it to the platform. Only the web-ported skins set it.
   */
  lineHeight: { body: number; heading: number } | null;
}

/**
 * Motion knobs. Mirrors the web's --duration-* / --ease-interaction /
 * --press-scale / --focus-scale: components never pick their own motion, the
 * skin does (office = 0 → instant, kids = long + overshoot).
 * @public part of the Tokens contract
 */
export interface MotionTokens {
  /** State-change duration (ms). 0 = instant. */
  durationFast: number;
  /** Expand/collapse duration (ms) — accordion & co. 0 = instant. */
  durationExpand: number;
  /** cubic-bezier(x1, y1, x2, y2) control points of --ease-interaction. */
  easing: readonly [number, number, number, number];
  /** Scale while pressed (kids squish). 1 = no change. */
  pressScale: number;
  /** Scale of a focused text field (kids pop). 1 = no change. */
  focusScale: number;
  /** Celebrate a checkbox becoming checked with a pop (web: kids-check-pop). */
  checkPop: boolean;
}

/**
 * Office-only 3D bevel colors (the web's --office-bevel-* / --office-btn-*).
 * Raised = light top/left + dark bottom/right; sunken is the inverse.
 * @public part of the Tokens contract
 */
export interface BevelTokens {
  light: string;
  dark: string;
  /** Button face gradient, top → bottom. */
  faceTop: string;
  faceBottom: string;
}

/**
 * Overlay geometry — the web's :root overlay tokens (same for every skin;
 * skins change overlays only through colors/radius/motion). See
 * docs/overlay-mobile.md.
 * @public part of the Tokens contract
 */
export interface OverlayTokens {
  /** Modal max widths (--overlay-width-sm/md/lg). */
  widthSm: number;
  widthMd: number;
  widthLg: number;
  /** Bottom sheet max height as a fraction of the window (--sheet-max-height 85dvh). */
  sheetMaxHeight: number;
  /** Modal sidebar width (--sidebar-width). */
  sidebarWidth: number;
  /**
   * Room a scroll box reserves so a child's focus ring / shadow is not sliced
   * at the scroll edge (--scroll-bleed). See components/ScrollBox.tsx.
   */
  scrollBleed: number;
}

export interface Tokens {
  /** Which skin these tokens belong to — lets skin rules scope themselves. */
  variant: DesignVariant;
  colors: ColorTokens;
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  /**
   * `sm`/`md`/`lg`/`full` are primitives; `control`, `surface` and `pill` are
   * the semantic shapes components use (buttons & inputs / cards / badges &
   * chips) — a skin reshapes the app by changing those three.
   */
  radius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
    control: number;
    surface: number;
    pill: number;
  };
  type: TypeScale;
  /** Minimum interactive size (pt); smaller visible controls pad up to it with hitSlop. */
  minTouchTarget: number;
  /**
   * VISIBLE height of buttons/inputs (web --control-height). Where it is below
   * `minTouchTarget` (standard/contrast 36, office 28) the touch area is kept
   * at the platform minimum via hitSlop.
   */
  controlHeight: number;
  /** Visible height of compact chips (radio options, filters). */
  chipHeight: number;
  /** Horizontal padding inside buttons/inputs. */
  controlPaddingX: number;
  borderWidth: number;
  /** Focus ring stroke (web --focus-ring-width), drawn 2pt outside the control. */
  focusRingWidth: number;
  /** CSS box-shadow for surfaces (cards), or null for none. */
  surfaceShadow: string | null;
  motion: MotionTokens;
  /** Office bevel colors; null for every other skin. */
  bevel: BevelTokens | null;
  overlay: OverlayTokens;
}

/** Platform the tokens are resolved for (fonts differ per OS). */
export type TokenPlatform = 'ios' | 'android';

// ── standard / contrast: verbatim from [data-design=standard|contrast][data-theme=*]
// The scrim is per skin on the web (:root 45%, contrast 65%), not per theme.
const STANDARD_COLORS: Record<ColorSchemeName, ColorTokens> = {
  light: {
    bg: '#f6f6fa',
    surface: '#ffffff',
    surfaceAlt: '#ffffff',
    text: '#23283a',
    textMuted: '#69708a',
    primary: '#5b5bd6',
    onPrimary: '#ffffff',
    border: '#e3e5ee',
    danger: '#d64550',
    onDanger: '#ffffff',
    success: '#1a9e56',
    warning: '#c07a12',
    focus: '#5b5bd6',
    overlay: 'rgba(0, 0, 0, 0.45)',
  },
  dark: {
    bg: '#14161e',
    surface: '#1d2029',
    surfaceAlt: '#262a36',
    text: '#e7e9f2',
    textMuted: '#9ba2b8',
    primary: '#8f8ff2',
    onPrimary: '#14161e',
    border: '#313545',
    danger: '#f0707a',
    onDanger: '#14161e',
    success: '#4ecb84',
    warning: '#e0a33e',
    focus: '#8f8ff2',
    overlay: 'rgba(0, 0, 0, 0.45)',
  },
};

const CONTRAST_COLORS: Record<ColorSchemeName, ColorTokens> = {
  light: {
    bg: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: '#f2f2f2',
    text: '#000000',
    textMuted: '#3d3d3d',
    primary: '#0038a8',
    onPrimary: '#ffffff',
    border: '#000000',
    danger: '#a80000',
    onDanger: '#ffffff',
    success: '#005e2b',
    warning: '#7a4d00',
    focus: '#0038a8',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
  dark: {
    bg: '#000000',
    surface: '#0d0d0d',
    surfaceAlt: '#1a1a1a',
    text: '#ffffff',
    textMuted: '#d6d6d6',
    primary: '#82b1ff',
    onPrimary: '#000000',
    border: '#ffffff',
    danger: '#ff8080',
    onDanger: '#000000',
    success: '#57d787',
    warning: '#ffc457',
    focus: '#82b1ff',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
};

// ── office: verbatim from [data-design='office'][data-theme=*] ──────────────
const OFFICE_COLORS: Record<ColorSchemeName, ColorTokens> = {
  // Silver/Luna chrome.
  light: {
    bg: '#d4d0c8', // classic window-chrome gray
    surface: '#ffffff', // document / input area
    surfaceAlt: '#ece9d8', // toolbar band (--color-surface-raised)
    text: '#000000',
    textMuted: '#4d4d4d',
    primary: '#21569e', // Office/Luna blue
    onPrimary: '#ffffff',
    border: '#808080', // flat 1px control border
    danger: '#a80000',
    onDanger: '#ffffff',
    success: '#2d7d2d',
    warning: '#9c6500',
    focus: '#21569e',
    overlay: 'rgba(0, 0, 0, 0.25)',
  },
  // Graphite ribbon.
  dark: {
    bg: '#333333',
    surface: '#2b2b2b',
    surfaceAlt: '#3f3f3f',
    text: '#f0f0f0',
    textMuted: '#b0b0b0',
    primary: '#4a8ad4',
    onPrimary: '#ffffff',
    border: '#5a5a5a',
    danger: '#d16a6a',
    onDanger: '#ffffff',
    success: '#4ea64e',
    warning: '#cf9b34',
    focus: '#7aa8e0',
    overlay: 'rgba(0, 0, 0, 0.25)',
  },
};

const OFFICE_BEVEL: Record<ColorSchemeName, BevelTokens> = {
  light: { light: '#ffffff', dark: '#808080', faceTop: '#fbfbfa', faceBottom: '#d7d3ca' },
  dark: { light: '#5f5f5f', dark: '#141414', faceTop: '#4a4a4a', faceBottom: '#333333' },
};

// ── kids: verbatim from [data-design='kids'][data-theme=*] ──────────────────
const KIDS_COLORS: Record<ColorSchemeName, ColorTokens> = {
  light: {
    bg: '#fff7ec', // warm cream classroom
    surface: '#ffffff',
    surfaceAlt: '#fff0d6',
    text: '#35235e', // deep grape, softer than black
    textMuted: '#7a6aa6',
    primary: '#4f7cff', // toy blue
    onPrimary: '#ffffff',
    border: '#2c2150', // dark chunky cartoon outline
    danger: '#ff4d6d',
    onDanger: '#ffffff',
    success: '#23c268',
    warning: '#ff9f1c',
    focus: '#ffb703', // sunny focus ring
    overlay: 'rgba(0, 0, 0, 0.45)',
  },
  dark: {
    bg: '#1b1236', // night-sky purple
    surface: '#271a49',
    surfaceAlt: '#34235f',
    text: '#f4ecff',
    textMuted: '#b9a8e6',
    primary: '#7aa2ff',
    onPrimary: '#14102b',
    border: '#7c5cff', // glowing outline
    danger: '#ff6b88',
    onDanger: '#14102b',
    success: '#4ade80',
    warning: '#ffc23d',
    focus: '#ffd60a',
    overlay: 'rgba(0, 0, 0, 0.45)',
  },
};

const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** Verbatim from the web :root (1rem = 16pt). */
const OVERLAY: OverlayTokens = {
  widthSm: 352, // 22rem
  widthMd: 544, // 34rem
  widthLg: 736, // 46rem
  sheetMaxHeight: 0.85, // 85dvh
  sidebarWidth: 320, // 20rem
  scrollBleed: 12, // --space-3
};

/** Web base motion: --duration-fast 150ms, --duration-expand 240ms, `ease`. */
const CALM_MOTION: MotionTokens = {
  durationFast: 150,
  durationExpand: 240,
  easing: [0.25, 0.1, 0.25, 1],
  pressScale: 1,
  focusScale: 1,
  checkPop: false,
};

/**
 * The web font stacks resolved to the first family each phone actually has —
 * i.e. what the web skin itself renders with in that phone's browser.
 *   office: 'Segoe UI', Tahoma, Geneva, Verdana, … → iOS: Verdana; Android: none → system
 *   kids:   'Baloo 2', 'Comic Sans MS', 'Chalkboard SE', … → iOS: Chalkboard SE; Android: system
 */
const FONT_FAMILY: Record<'office' | 'kids', Record<TokenPlatform, string | undefined>> = {
  office: { ios: 'Verdana', android: undefined },
  kids: { ios: 'Chalkboard SE', android: undefined },
};

export function getTokens(
  variant: DesignVariant,
  scheme: ColorSchemeName,
  platform: TokenPlatform = 'ios',
): Tokens {
  switch (variant) {
    case 'contrast':
      // Standard's shape, contrast's colors; the only non-color differences are
      // the thicker lines (web --border-width 2px, --focus-ring-width 4px) and
      // the darker scrim (in CONTRAST_COLORS). Formerly B — its bigger type and
      // controls are gone with upstream #28.
      return {
        ...getTokens('standard', scheme, platform),
        variant,
        colors: CONTRAST_COLORS[scheme],
        borderWidth: 2,
        focusRingWidth: 4,
      };
    case 'office':
      return {
        variant,
        colors: OFFICE_COLORS[scheme],
        spacing: SPACING,
        // Nearly square everything (--radius-control / --radius-surface: 2px,
        // and the office override squares badges too).
        radius: { sm: 2, md: 2, lg: 2, full: 999, control: 2, surface: 2, pill: 2 },
        type: {
          title: 22, // --font-size-2xl 1.375rem
          heading: 18, // --font-size-xl 1.125rem
          body: 13, // --font-size-body 0.8125rem
          caption: 11, // --font-size-sm 0.6875rem — toolbar/label text
          emphasis: '700',
          fontFamily: FONT_FAMILY.office[platform],
          lineHeight: { body: 1.4, heading: 1.25 }, // tight, information-dense
        },
        // Visible controls are the compact 1.75rem toolbar size; the touch
        // area stays at the platform minimum through hitSlop.
        minTouchTarget: 44,
        controlHeight: 28,
        chipHeight: 28,
        controlPaddingX: SPACING.sm, // --space-2
        borderWidth: 1,
        focusRingWidth: 1, // the dotted Windows focus rectangle
        surfaceShadow: null,
        // Restrained: state changes are instant — no easing, no motion.
        motion: { ...CALM_MOTION, durationFast: 0, durationExpand: 0 },
        bevel: OFFICE_BEVEL[scheme],
        overlay: OVERLAY,
      };
    case 'kids':
      return {
        variant,
        colors: KIDS_COLORS[scheme],
        spacing: SPACING,
        // Pill-shaped controls, big rounded surfaces (--radius-xl 28px).
        radius: { sm: 6, md: 10, lg: 28, full: 999, control: 999, surface: 28, pill: 999 },
        type: {
          title: 40, // --font-size-2xl 2.5rem
          heading: 30, // --font-size-xl 1.875rem
          body: 17, // --font-size-body 1.0625rem
          caption: 15, // --font-size-sm 0.9375rem
          emphasis: '800',
          fontFamily: FONT_FAMILY.kids[platform],
          lineHeight: { body: 1.6, heading: 1.25 },
        },
        minTouchTarget: 48,
        controlHeight: 48, // --control-height 3rem
        chipHeight: 40,
        controlPaddingX: SPACING.md, // --space-4
        borderWidth: 3, // thick cartoon outline
        focusRingWidth: 4,
        // Hard offset drop-shadow → sticker / toy-stud look.
        surfaceShadow: '0px 6px 0px rgba(0, 0, 0, 0.12), 0px 14px 26px rgba(0, 0, 0, 0.1)',
        // Exaggerated motion: overshoot spring + big squish/pop.
        motion: {
          durationFast: 220,
          durationExpand: 380,
          easing: [0.34, 1.8, 0.5, 1], // springy overshoot
          pressScale: 0.9,
          focusScale: 1.04,
          checkPop: true,
        },
        bevel: null,
        overlay: OVERLAY,
      };
    case 'standard':
      // Port of [data-design='standard'] (shared with contrast), 1rem = 16pt.
      return {
        variant,
        colors: STANDARD_COLORS[scheme],
        spacing: SPACING,
        // --radius-sm/md/lg; controls use md (10), surfaces lg (16).
        radius: { sm: 6, md: 10, lg: 16, full: 999, control: 10, surface: 16, pill: 999 },
        type: {
          title: 32, // --font-size-2xl 2rem
          heading: 24, // --font-size-xl 1.5rem
          body: 15, // --font-size-body 0.9375rem
          caption: 13, // --font-size-sm 0.8125rem
          // --font-weight-heading 650: phones have no 650 cut, and CSS font
          // matching resolves a weight above 500 upward — 700 in the browser too.
          emphasis: '700',
          fontFamily: undefined, // Pretendard → -apple-system / Roboto = system
          lineHeight: { body: 1.6, heading: 1.25 },
        },
        minTouchTarget: 44,
        controlHeight: 36, // --control-height 2.25rem; hitSlop keeps 44 to touch
        chipHeight: 36, // the web's filters are controls (Select), same height
        controlPaddingX: 12, // --space-3
        borderWidth: 1,
        focusRingWidth: 2,
        surfaceShadow: '0px 1px 3px rgba(0, 0, 0, 0.08)',
        motion: CALM_MOTION,
        bevel: null,
        overlay: OVERLAY,
      };
  }
}
