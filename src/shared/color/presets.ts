/**
 * Palette preset model + the default swatch set, shared by every surface that
 * offers a color input (the web `Palette` in src/client/ui/palette.tsx and the
 * app's `Palette` in apps/mobile). One definition means "Indigo" is the same
 * `#6366f1` on the web and on a phone — the value a user picked is their data,
 * and data must not depend on which client they picked it in.
 *
 * Lives beside (not inside) the color facade so `@shared/color` stays a pure
 * value module; import from `@shared/color/presets`.
 */
import { hexColor, type HexColor } from './index';

export interface PaletteSwatch {
  value: HexColor;
  /**
   * Accessible name — required, not optional. Reading `#5b5bd6` aloud is not
   * information, and a swatch grid conveys everything else through color
   * alone. The type system is what stops an unnamed swatch existing at all,
   * the same way `testId` stops an unautomatable control existing.
   */
  name: string;
}

/** @public part of the component contract — how callers type their own presets. */
export interface PaletteGroup {
  /** Shown above the grid, and used as the group's accessible name. */
  label?: string;
  swatches: readonly PaletteSwatch[];
}

/**
 * Default presets: neutrals, warm, cool, soft — four rows of eight.
 * Names are English on purpose: they are content, not chrome, so an app that
 * needs them localized passes its own `presets` rather than having the design
 * system guess. Values are fixed across skins — a color the user picked is
 * their data, and data must not change when the UI theme does.
 */
const DEFAULT_SWATCHES: readonly PaletteSwatch[] = (
  [
    ['#ffffff', 'White'],
    ['#e5e7eb', 'Light gray'],
    ['#9ca3af', 'Gray'],
    ['#64748b', 'Slate'],
    ['#475569', 'Dark slate'],
    ['#334155', 'Charcoal'],
    ['#1f2937', 'Ink'],
    ['#000000', 'Black'],
    ['#f43f5e', 'Rose'],
    ['#ef4444', 'Red'],
    ['#f97316', 'Orange'],
    ['#f59e0b', 'Amber'],
    ['#eab308', 'Yellow'],
    ['#84cc16', 'Lime'],
    ['#65a30d', 'Olive'],
    ['#92400e', 'Brown'],
    ['#22c55e', 'Green'],
    ['#10b981', 'Emerald'],
    ['#14b8a6', 'Teal'],
    ['#06b6d4', 'Cyan'],
    ['#0ea5e9', 'Sky'],
    ['#3b82f6', 'Blue'],
    ['#6366f1', 'Indigo'],
    ['#8b5cf6', 'Violet'],
    ['#a855f7', 'Purple'],
    ['#d946ef', 'Fuchsia'],
    ['#ec4899', 'Pink'],
    ['#fb7185', 'Salmon'],
    ['#fdba74', 'Peach'],
    ['#6ee7b7', 'Mint'],
    ['#c4b5fd', 'Lavender'],
    ['#e7d8b1', 'Sand'],
  ] as const
).map(([value, name]) => ({ value: hexColor(value), name }));

export const DEFAULT_PALETTE_GROUPS: readonly PaletteGroup[] = [{ swatches: DEFAULT_SWATCHES }];
