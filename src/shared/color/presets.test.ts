import { describe, expect, test } from 'bun:test';

import { isHexColor } from './index';
import { DEFAULT_PALETTE_GROUPS } from './presets';

describe('DEFAULT_PALETTE_GROUPS', () => {
  const swatches = DEFAULT_PALETTE_GROUPS.flatMap((group) => group.swatches);

  test('is the 32-color set (four rows of eight on the web)', () => {
    expect(swatches).toHaveLength(32);
  });

  test('every value is canonical, so preset highlighting can compare with ===', () => {
    for (const swatch of swatches) expect(isHexColor(swatch.value)).toBe(true);
  });

  test('values and names are unique and every swatch is named', () => {
    expect(new Set(swatches.map((swatch) => swatch.value)).size).toBe(swatches.length);
    expect(new Set(swatches.map((swatch) => swatch.name)).size).toBe(swatches.length);
    for (const swatch of swatches) expect(swatch.name.trim()).not.toBe('');
  });
});
