import { describe, expect, test } from 'bun:test';

import { beginClose, derive, open, remove, type OverlayStackEntry } from './overlay-stack';

const empty: readonly OverlayStackEntry[] = [];

// Same cases as the web stack (src/client/ui/overlay/overlay-stack.test.ts);
// the counted resource is the native host layer instead of the scroll lock.
describe('overlay stack', () => {
  test('nothing is claimed while the stack is empty', () => {
    expect(derive(empty)).toEqual({ topActive: null, hostPresented: false, depth: 0 });
  });

  test('a single overlay owns the scrim and back, and presents the host', () => {
    expect(derive(open(empty, 'a'))).toEqual({ topActive: 'a', hostPresented: true, depth: 1 });
  });

  test('exactly one scrim no matter how deep the stack is', () => {
    const stack = open(open(open(empty, 'a'), 'b'), 'c');
    expect(derive(stack).topActive).toBe('c');
    expect(derive(stack).depth).toBe(3);
  });

  test('the scrim (and back) move down the instant the top starts closing', () => {
    expect(derive(beginClose(open(open(empty, 'a'), 'b'), 'b')).topActive).toBe('a');
  });

  test('a closing overlay keeps the host presented', () => {
    // Dismissing the native layer mid-animation would cut the exit short.
    expect(derive(beginClose(open(empty, 'a'), 'a'))).toEqual({
      topActive: null,
      hostPresented: true,
      depth: 0,
    });
  });

  test('the host goes away only once the last entry is gone', () => {
    const two = open(open(empty, 'a'), 'b');
    expect(derive(remove(two, 'b')).hostPresented).toBe(true);
    expect(derive(remove(remove(two, 'b'), 'a')).hostPresented).toBe(false);
  });

  test('closing the inner overlay hands the scrim back to the outer one', () => {
    const settled = remove(beginClose(open(open(empty, 'form'), 'confirm'), 'confirm'), 'confirm');
    expect(derive(settled)).toEqual({ topActive: 'form', hostPresented: true, depth: 1 });
  });

  test('re-opening while closing moves the entry back to the top', () => {
    const stack = open(beginClose(open(open(empty, 'a'), 'b'), 'b'), 'b');
    expect(stack).toEqual([
      { id: 'a', active: true },
      { id: 'b', active: true },
    ]);
    expect(derive(stack).topActive).toBe('b');
  });

  test('removing an unknown id is a no-op', () => {
    const stack = open(empty, 'a');
    expect(remove(stack, 'ghost')).toEqual(stack);
    expect(beginClose(stack, 'ghost')).toEqual(stack);
  });
});
