/**
 * iOS system color picker. (Platform-split module — see native-picker.d.ts
 * and docs/platform-decisions.md #6 for the rationale.)
 *
 * Backed by the local Expo module in apps/mobile/modules/native-color-picker
 * (UIColorPickerViewController). Optional on purpose: a JS-only runtime
 * without the native build (e.g. Expo Go) reports "unavailable" and the
 * Palette hides the button instead of crashing.
 */
import { NativeModule, requireOptionalNativeModule } from 'expo';

import { parseHexColor, type HexColor } from '@shared/color';

import type { NativeColorPickRequest } from './native-picker';

// A type alias (not an interface) so it satisfies NativeModule's EventsMap.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type PickerEvents = {
  onPreview: (event: { value: string }) => void;
};

declare class NativeColorPickerModule extends NativeModule<PickerEvents> {
  pick(initialHex: string, title: string): Promise<string>;
}

const native = requireOptionalNativeModule<NativeColorPickerModule>('NativeColorPicker');

export const nativeColorPickerAvailable = native !== null;

export async function pickNativeColor({
  initial,
  title,
  onPreview,
}: NativeColorPickRequest): Promise<HexColor | null> {
  if (!native) return null;
  const subscription = onPreview
    ? native.addListener('onPreview', ({ value }) => {
        const parsed = parseHexColor(value);
        if (parsed) onPreview(parsed);
      })
    : null;
  try {
    return parseHexColor(await native.pick(initial, title));
  } catch {
    return null;
  } finally {
    subscription?.remove();
  }
}
