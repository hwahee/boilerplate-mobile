import { describe, expect, test } from 'bun:test';

import {
  accordionSkin,
  bevelBorder,
  buttonSkin,
  cardSkin,
  fieldSkin,
  mixSrgb,
  paletteSkin,
  touchSlop,
  withAlpha,
} from './skin';
import { getTokens } from './tokens';

const rest = { pressed: false, disabled: false, reduceMotion: false };
const pressed = { ...rest, pressed: true };

describe('color helpers', () => {
  test('mixSrgb matches CSS color-mix(in srgb, a p%, b)', () => {
    expect(mixSrgb('#000000', '#ffffff', 0.5)).toBe('#808080');
    // office primary gradient top: color-mix(in srgb, #21569e 72%, white)
    expect(mixSrgb('#21569e', '#ffffff', 0.72)).toBe('#5f85b9');
  });

  test('withAlpha', () => {
    expect(withAlpha('#ffb703', 0.55)).toBe('rgba(255, 183, 3, 0.55)');
  });
});

describe('designs A and B are untouched by skin rules', () => {
  test.each(['a', 'b'] as const)('%s', (variant) => {
    const tokens = getTokens(variant, 'light');
    expect(buttonSkin(tokens, 'primary', pressed)).toEqual({ container: {} });
    expect(fieldSkin(tokens, { focused: true })).toEqual({});
    expect(cardSkin(tokens)).toEqual({});
    expect(accordionSkin(tokens)).toEqual({ trigger: {}, separatorColor: tokens.colors.border });
    expect(touchSlop(tokens, tokens.controlHeight)).toBeUndefined();
  });
});

describe('office', () => {
  const tokens = getTokens('office', 'light');
  const bevel = tokens.bevel!;

  test('buttons are raised and press IN with a 1px nudge (no reflow)', () => {
    const up = buttonSkin(tokens, 'secondary', rest);
    expect(up.container).toMatchObject(bevelBorder(bevel, 'raised'));
    expect(up.container.transform).toBeUndefined();
    expect(up.container.experimental_backgroundImage).toBe('linear-gradient(#fbfbfa, #d7d3ca)');
    expect(up.labelWeight).toBe('400');
    expect(up.labelColor).toBe(tokens.colors.text);

    const down = buttonSkin(tokens, 'secondary', pressed);
    expect(down.container).toMatchObject(bevelBorder(bevel, 'sunken'));
    expect(down.container.transform).toEqual([{ translateX: 1 }, { translateY: 1 }]);
    expect(down.opacity).toBe(1);
  });

  test('primary face is a primary-tinted gradient; danger is flat', () => {
    expect(buttonSkin(tokens, 'primary', rest).container.experimental_backgroundImage).toBe(
      'linear-gradient(#5f85b9, #21569e)',
    );
    expect(
      buttonSkin(tokens, 'danger', rest).container.experimental_backgroundImage,
    ).toBeUndefined();
  });

  test('disabled buttons do not press and fade to .55', () => {
    const skin = buttonSkin(tokens, 'primary', { ...pressed, disabled: true });
    expect(skin.container.transform).toBeUndefined();
    expect(skin.opacity).toBe(0.55);
  });

  test('inputs are sunken; focus is the dotted rectangle', () => {
    expect(fieldSkin(tokens, { focused: false })).toMatchObject(bevelBorder(bevel, 'sunken'));
    expect(fieldSkin(tokens, { focused: true })).toMatchObject({
      outlineStyle: 'dotted',
      outlineWidth: 1,
      outlineColor: tokens.colors.text,
    });
  });

  test('cards are raised group boxes; accordion headers are button faces', () => {
    expect(cardSkin(tokens)).toEqual(bevelBorder(bevel, 'raised'));
    expect(accordionSkin(tokens).separatorColor).toBe(bevel.dark);
  });

  test('compact 28pt controls get their touch area back through hitSlop', () => {
    expect(touchSlop(tokens, tokens.controlHeight)).toBe(8);
  });
});

describe('kids', () => {
  const tokens = getTokens('kids', 'light');

  test('buttons sit on a sticker shadow that flattens while squished', () => {
    expect(buttonSkin(tokens, 'primary', rest).container.boxShadow).toBe(
      '0px 5px 0px rgba(0, 0, 0, 0.18)',
    );
    expect(buttonSkin(tokens, 'primary', pressed).container.boxShadow).toBe(
      '0px 1px 0px rgba(0, 0, 0, 0.18)',
    );
    expect(buttonSkin(tokens, 'ghost', rest).container).toEqual({});
  });

  test('reduce motion keeps the resting shadow and the base press fade', () => {
    const skin = buttonSkin(tokens, 'primary', { ...pressed, reduceMotion: true });
    expect(skin.container.boxShadow).toBe('0px 5px 0px rgba(0, 0, 0, 0.18)');
    expect(skin.opacity).toBeUndefined();
  });

  test('focused inputs get the ring plus the glow', () => {
    expect(fieldSkin(tokens, { focused: false })).toEqual({});
    expect(fieldSkin(tokens, { focused: true })).toMatchObject({
      outlineWidth: 4,
      outlineColor: tokens.colors.focus,
      boxShadow: '0px 0px 0px 5px rgba(255, 183, 3, 0.55)',
    });
  });

  test('cards carry the hard drop shadow', () => {
    expect(cardSkin(tokens)).toEqual({ boxShadow: tokens.surfaceShadow! });
  });
});

describe('palette', () => {
  test('A/B swatches are touch-sized with the web selection ring', () => {
    const tokens = getTokens('a', 'light');
    const skin = paletteSkin(tokens);
    expect(skin.swatchSize).toBe(tokens.minTouchTarget);
    expect(skin.swatchHitSlop).toBeUndefined();
    expect(skin.selectedRing).toContain(tokens.colors.focus);
    expect(skin.pressPop).toBe(false);
  });

  test('office: dense square grid, inset selection, yellow tooltip, sunken trigger', () => {
    const tokens = getTokens('office', 'light');
    const skin = paletteSkin(tokens);
    expect(skin.swatchSize).toBe(21); // --control-height (28) * 0.75
    expect(skin.swatchRadius).toBe(0);
    expect(skin.gridGap).toBe(2);
    expect(skin.selectedRing).toBeNull();
    expect(skin.selectedInset).toEqual({ borderWidth: 2, borderColor: tokens.colors.primary });
    expect(skin.callout.backgroundColor).toBe('#ffffe1');
    expect(skin.trigger).toMatchObject(bevelBorder(tokens.bevel!, 'sunken'));
  });

  test('kids: round candy swatches that pop, touch area topped up without overlap', () => {
    const tokens = getTokens('kids', 'light');
    const skin = paletteSkin(tokens);
    expect(skin.swatchSize).toBe(36);
    expect(skin.swatchRadius).toBe(tokens.radius.full);
    expect(skin.swatchHitSlop).toBeLessThanOrEqual(skin.gridGap / 2);
    expect(skin.triggerWeight).toBe('800');
    expect(skin.pressPop).toBe(true);
  });
});
