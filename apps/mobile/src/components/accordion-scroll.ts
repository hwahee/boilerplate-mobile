/**
 * Scroll correction for the accordion's layout-shift escape hatches — pure, so
 * the geometry is unit-tested (accordion-scroll.test.ts).
 *
 * The web version (src/client/ui/accordion.tsx) corrects scroll frame by frame
 * while a CSS transition runs. On the app the expand/collapse runs natively
 * (LayoutAnimation), and the FINAL layout is known the moment React commits —
 * so both corrections fold into ONE scroll, issued alongside the animation:
 *
 *   #1 anchor — the pressed trigger stays where it was on screen (saves
 *      `single` mode, where opening an item collapses a taller one above it);
 *   #2 reveal — an opened panel cut off by the viewport bottom is scrolled into
 *      view, but never so far that its trigger leaves the viewport.
 *
 * All coordinates are window-relative (measureInWindow), in points.
 */

/** Gap kept between the viewport top and the trigger when revealing a panel. */
export const REVEAL_TOP_MARGIN = 12;

export interface ScrollPlanInput {
  /** Trigger top before the toggle. */
  triggerTopBefore: number;
  /** Trigger top in the committed (final) layout, before any correction. */
  triggerTopAfter: number;
  /** Panel bottom in the committed layout, before any correction. */
  panelBottomAfter: number;
  viewportTop: number;
  viewportBottom: number;
  /** true when the toggle opened the panel (reveal only applies then). */
  opened: boolean;
}

/** How far to scroll (positive = content moves up). 0 = leave it. */
export function planAccordionScroll(input: ScrollPlanInput): number {
  // #1 — cancel whatever moved the trigger.
  const anchor = input.triggerTopAfter - input.triggerTopBefore;
  if (!input.opened) return anchor;

  // #2 — positions once the anchor correction has been applied.
  const triggerTop = input.triggerTopAfter - anchor;
  const panelBottom = input.panelBottomAfter - anchor;
  const overflow = panelBottom - input.viewportBottom;
  if (overflow <= 0) return anchor;
  const headroom = Math.max(0, triggerTop - input.viewportTop - REVEAL_TOP_MARGIN);
  return anchor + Math.min(overflow, headroom);
}
