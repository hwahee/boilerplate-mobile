/**
 * The office and kids skins are PORTS of the web skins, so their values are
 * checked against the web's own stylesheet rather than against numbers copied
 * into this test: if src/client/styles/tokens.css changes a skin upstream, this
 * test fails until the app follows.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DESIGN_VARIANTS, getTokens, isDesignVariant, type ColorTokens } from './tokens';

const css = readFileSync(
  join(import.meta.dir, '../../../../src/client/styles/tokens.css'),
  'utf8',
).replaceAll(/\/\*[\s\S]*?\*\//g, '');

/** Custom properties declared in the block whose selector is exactly `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const vars: Record<string, string> = {};
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars[match[1]!] = match[2]!.replaceAll(/\s+/g, ' ').trim();
  }
  return vars;
}

const root = block(':root');

/** Value of `--name` in `vars`, following var() references into :root. */
function resolve(vars: Record<string, string>, name: string): string {
  const value = vars[name] ?? root[name];
  if (value === undefined) throw new Error(`--${name} not declared`);
  const reference = /^var\(--([\w-]+)\)$/.exec(value);
  return reference ? resolve(vars, reference[1]!) : value;
}

/** CSS length → points (1rem = 16pt, px = pt). */
function points(value: string): number {
  if (value.endsWith('rem')) return parseFloat(value) * 16;
  if (value.endsWith('px')) return parseFloat(value);
  throw new Error(`not a length: ${value}`);
}

/** CSS time → ms. */
function ms(value: string): number {
  return value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000;
}

/** Web semantic color → app color token. */
const COLOR_MAP: Record<string, keyof ColorTokens> = {
  'color-bg': 'bg',
  'color-surface': 'surface',
  'color-surface-raised': 'surfaceAlt',
  'color-text': 'text',
  'color-text-muted': 'textMuted',
  'color-primary': 'primary',
  'color-primary-contrast': 'onPrimary',
  'color-border': 'border',
  'color-danger': 'danger',
  'color-danger-contrast': 'onDanger',
  'color-success': 'success',
  'color-warning': 'warning',
  'color-focus': 'focus',
};

describe.each(['office', 'kids'] as const)('%s skin matches the web', (variant) => {
  const sizing = block(`[data-design='${variant}']`);

  test.each(['light', 'dark'] as const)('%s colors', (scheme) => {
    const web = block(`[data-design='${variant}'][data-theme='${scheme}']`);
    const { colors } = getTokens(variant, scheme);
    for (const [cssName, token] of Object.entries(COLOR_MAP)) {
      expect({ [token]: colors[token].toLowerCase() }).toEqual({ [token]: web[cssName]! });
    }
  });

  test('type scale (title/heading/body/caption = 2xl/xl/body/sm)', () => {
    const { type } = getTokens(variant, 'light');
    expect(type.title).toBe(points(resolve(sizing, 'font-size-2xl')));
    expect(type.heading).toBe(points(resolve(sizing, 'font-size-xl')));
    expect(type.body).toBe(points(resolve(sizing, 'font-size-body')));
    expect(type.caption).toBe(points(resolve(sizing, 'font-size-sm')));
    expect(type.emphasis).toBe(resolve(sizing, 'font-weight-heading') as typeof type.emphasis);
    expect(type.lineHeight?.body).toBe(parseFloat(resolve(sizing, 'line-height-body')));
  });

  test('control and surface shape', () => {
    const tokens = getTokens(variant, 'light');
    expect(tokens.controlHeight).toBe(points(resolve(sizing, 'control-height')));
    expect(tokens.controlPaddingX).toBe(points(resolve(sizing, 'control-padding-x')));
    expect(tokens.radius.control).toBe(points(resolve(sizing, 'radius-control')));
    expect(tokens.radius.surface).toBe(points(resolve(sizing, 'radius-surface')));
    expect(tokens.borderWidth).toBe(points(resolve(sizing, 'border-width')));
  });

  test('motion', () => {
    const { motion } = getTokens(variant, 'light');
    expect(motion.durationFast).toBe(ms(resolve(sizing, 'duration-fast')));
    expect(motion.durationExpand).toBe(ms(resolve(sizing, 'duration-expand')));
    expect(motion.pressScale).toBe(parseFloat(resolve(sizing, 'press-scale')));
    expect(motion.focusScale).toBe(parseFloat(resolve(sizing, 'focus-scale')));
  });
});

describe('office-only tokens', () => {
  test.each(['light', 'dark'] as const)('%s bevel', (scheme) => {
    const web = block(`[data-design='office'][data-theme='${scheme}']`);
    expect(getTokens('office', scheme).bevel).toEqual({
      light: web['office-bevel-light']!,
      dark: web['office-bevel-dark']!,
      faceTop: web['office-btn-top']!,
      faceBottom: web['office-btn-bottom']!,
    });
  });

  test('compact controls keep the platform touch minimum', () => {
    const tokens = getTokens('office', 'light');
    expect(tokens.controlHeight).toBe(28);
    expect(tokens.minTouchTarget).toBe(44);
  });

  test('fonts resolve the web stack to what each phone has', () => {
    expect(getTokens('office', 'light', 'ios').type.fontFamily).toBe('Verdana');
    expect(getTokens('office', 'light', 'android').type.fontFamily).toBeUndefined();
  });
});

describe('kids-only tokens', () => {
  test('springy overshoot easing = --ease-interaction', () => {
    const sizing = block(`[data-design='kids']`);
    const [x1, y1, x2, y2] = getTokens('kids', 'light').motion.easing;
    expect(`cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`).toBe(resolve(sizing, 'ease-interaction'));
  });
});

describe('design variants', () => {
  test('A and B keep their mobile values (no web port)', () => {
    const a = getTokens('a', 'light');
    expect(a.controlHeight).toBe(a.minTouchTarget);
    expect(a.radius.control).toBe(a.radius.md);
    expect(a.radius.surface).toBe(a.radius.lg);
    expect(a.bevel).toBeNull();
    expect(a.motion.durationFast).toBe(ms(root['duration-fast']!));
  });

  test('isDesignVariant accepts exactly the four variants', () => {
    for (const variant of DESIGN_VARIANTS) expect(isDesignVariant(variant)).toBe(true);
    expect(isDesignVariant('c')).toBe(false);
    expect(isDesignVariant(null)).toBe(false);
  });
});
