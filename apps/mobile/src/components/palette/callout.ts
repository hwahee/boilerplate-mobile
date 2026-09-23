/**
 * Where the press-and-hold callout goes — pure, so it is unit-tested
 * (callout.test.ts).
 *
 * The web shows a hover tooltip with the swatch's name and the exact string it
 * returns. A touch screen has no hover, so the app shows the same callout while
 * a finger is DOWN on a swatch — above the finger (which covers the swatch
 * itself), like the iOS keyboard's key preview. It flips below when there is no
 * room above and is clamped inside the sheet horizontally.
 *
 * Coordinates are relative to the container the callout is rendered in.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CalloutPlacement {
  left: number;
  top: number;
  side: 'top' | 'bottom';
}

/** Space between the swatch and the callout. */
export const CALLOUT_GAP = 6;
/** Minimum distance kept from the container's left/right edges. */
export const CALLOUT_EDGE_MARGIN = 8;

export function placeCallout(
  anchor: Box,
  callout: { width: number; height: number },
  containerWidth: number,
): CalloutPlacement {
  const above = anchor.y - CALLOUT_GAP - callout.height;
  const side = above >= 0 ? 'top' : 'bottom';
  const top = side === 'top' ? above : anchor.y + anchor.height + CALLOUT_GAP;

  const centered = anchor.x + anchor.width / 2 - callout.width / 2;
  const maxLeft = containerWidth - CALLOUT_EDGE_MARGIN - callout.width;
  const left = Math.max(CALLOUT_EDGE_MARGIN, Math.min(centered, maxLeft));

  return { left, top, side };
}
