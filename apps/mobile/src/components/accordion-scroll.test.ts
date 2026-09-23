import { describe, expect, test } from 'bun:test';

import { planAccordionScroll, REVEAL_TOP_MARGIN } from './accordion-scroll';

const viewport = { viewportTop: 100, viewportBottom: 800 };

describe('planAccordionScroll', () => {
  test('does nothing when nothing moved and the panel fits', () => {
    expect(
      planAccordionScroll({
        ...viewport,
        triggerTopBefore: 300,
        triggerTopAfter: 300,
        panelBottomAfter: 600,
        opened: true,
      }),
    ).toBe(0);
  });

  test('anchors the trigger when a taller item above collapses (single mode)', () => {
    // The item above folded 250pt away: without correction the trigger jumps up.
    expect(
      planAccordionScroll({
        ...viewport,
        triggerTopBefore: 500,
        triggerTopAfter: 250,
        panelBottomAfter: 500,
        opened: true,
      }),
    ).toBe(-250);
  });

  test('anchors on close too, without revealing anything', () => {
    expect(
      planAccordionScroll({
        ...viewport,
        triggerTopBefore: 400,
        triggerTopAfter: 380,
        panelBottomAfter: 5000,
        opened: false,
      }),
    ).toBe(-20);
  });

  test('reveals an opened panel cut off by the viewport bottom', () => {
    expect(
      planAccordionScroll({
        ...viewport,
        triggerTopBefore: 500,
        triggerTopAfter: 500,
        panelBottomAfter: 900,
        opened: true,
      }),
    ).toBe(100);
  });

  test('never reveals so far that the trigger leaves the viewport', () => {
    // Panel is taller than the viewport: stop with the trigger at the top margin.
    expect(
      planAccordionScroll({
        ...viewport,
        triggerTopBefore: 500,
        triggerTopAfter: 500,
        panelBottomAfter: 2000,
        opened: true,
      }),
    ).toBe(500 - viewport.viewportTop - REVEAL_TOP_MARGIN);
  });

  test('combines anchor and reveal into one scroll', () => {
    // Trigger moved up 200 (anchor → -200); after that its panel ends at 900.
    expect(
      planAccordionScroll({
        ...viewport,
        triggerTopBefore: 600,
        triggerTopAfter: 400,
        panelBottomAfter: 700,
        opened: true,
      }),
    ).toBe(-200 + 100);
  });
});
