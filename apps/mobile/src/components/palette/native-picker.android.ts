/**
 * Android: no system color picker exists. (Platform-split module — see
 * native-picker.d.ts and docs/platform-decisions.md #6 for the rationale.)
 *
 * The Palette hides its "more colors" button here; presets and the hex field
 * still cover every color. This file is the seam if a picker is ever adopted.
 */
import type { HexColor } from '@shared/color';

export const nativeColorPickerAvailable = false;

export function pickNativeColor(): Promise<HexColor | null> {
  return Promise.resolve(null);
}
