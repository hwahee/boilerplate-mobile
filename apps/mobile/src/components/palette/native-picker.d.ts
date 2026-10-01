/**
 * Shared type surface of the platform-split system color picker.
 * Metro picks `native-picker.ios.ts` / `native-picker.android.ts` at bundle
 * time; TypeScript checks importers against this declaration.
 *
 * Why split (docs/platform-decisions.md #6): the Palette's third tier — "more
 * colors" — escalates to the OS picker, like the web's <input type="color">.
 * iOS has one (UIColorPickerViewController, with opacity); Android has none.
 * The Palette asks `nativeColorPickerAvailable` and simply hides the button
 * where there is nothing to open, so callers never see the platform.
 */
import type { HexColor } from '@shared/color';

export interface NativeColorPickRequest {
  initial: HexColor;
  /** Sheet title shown by the OS picker (the Palette's label). */
  title: string;
  /** Every intermediate selection while the picker is open (web: `input`). */
  onPreview?: (value: HexColor) => void;
}

/** True when this platform has a system color picker to escalate to. */
export declare const nativeColorPickerAvailable: boolean;

/**
 * Presents the system picker and resolves the color it was closed on
 * (web: `change`), or null when the picker is unavailable or failed.
 */
export declare function pickNativeColor(request: NativeColorPickRequest): Promise<HexColor | null>;
