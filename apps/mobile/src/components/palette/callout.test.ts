import { describe, expect, test } from 'bun:test';

import { CALLOUT_EDGE_MARGIN, CALLOUT_GAP, placeCallout } from './callout';

const callout = { width: 120, height: 30 };

describe('placeCallout', () => {
  test('centers above the swatch (the finger covers the swatch itself)', () => {
    const placement = placeCallout({ x: 140, y: 200, width: 40, height: 40 }, callout, 400);
    expect(placement).toEqual({ side: 'top', top: 200 - CALLOUT_GAP - 30, left: 100 });
  });

  test('flips below when there is no room above', () => {
    const placement = placeCallout({ x: 140, y: 10, width: 40, height: 40 }, callout, 400);
    expect(placement.side).toBe('bottom');
    expect(placement.top).toBe(10 + 40 + CALLOUT_GAP);
  });

  test('clamps inside the container at the grid edges', () => {
    expect(placeCallout({ x: 0, y: 200, width: 40, height: 40 }, callout, 400).left).toBe(
      CALLOUT_EDGE_MARGIN,
    );
    expect(placeCallout({ x: 370, y: 200, width: 30, height: 40 }, callout, 400).left).toBe(
      400 - CALLOUT_EDGE_MARGIN - 120,
    );
  });
});
