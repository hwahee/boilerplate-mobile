/**
 * Overlay stack — pure rules, no React Native and no React.
 *
 * App port of src/client/ui/overlay/overlay-stack.ts (docs/overlay-design.md
 * §2). The rules are the web's; what differs is which platform resources they
 * govern:
 *
 *   - exclusive (at most one) — the scrim, and the Android back button. The
 *     TOP-MOST active overlay owns both. (Web: scrim + ESC, where ESC order
 *     came free from <dialog>; RN has no such stack, so back is derived here.)
 *   - counted (1 or more)     — the native host layer. ONE RN <Modal> hosts
 *     every overlay (docs/overlay-mobile.md §2), and it must stay presented
 *     while ANY entry is present, closing ones included — dropping it
 *     mid-animation would cut the exit short. (Web: the body scroll lock.)
 *
 * Only MODAL overlays are entries. An inline sidebar is layout and never joins.
 */

export interface OverlayStackEntry {
  id: string;
  /**
   * Cleared the moment the overlay starts closing, while its exit animation
   * still plays: it keeps the host layer but stops owning the scrim and back.
   */
  active: boolean;
}

export interface OverlayStackDerivation {
  /** The single overlay that paints the scrim — and answers back — or null. */
  topActive: string | null;
  /** True while any entry is present, closing ones included. */
  hostPresented: boolean;
  /** Active (not closing) entries — what the depth warning counts. */
  depth: number;
}

/** Past this depth nesting is usually a design mistake; warns in development. */
export const NESTING_WARN_DEPTH = 3;

/**
 * Adds an overlay on top. Re-opening one that is still closing moves it back to
 * the top, which resolves the close-then-reopen race to "open".
 */
export function open(
  stack: readonly OverlayStackEntry[],
  id: string,
): readonly OverlayStackEntry[] {
  return [...stack.filter((entry) => entry.id !== id), { id, active: true }];
}

/** Marks an overlay as closing. It keeps its slot until `remove`. */
export function beginClose(
  stack: readonly OverlayStackEntry[],
  id: string,
): readonly OverlayStackEntry[] {
  return stack.map((entry) => (entry.id === id ? { ...entry, active: false } : entry));
}

/** Drops an overlay once its exit animation has finished. */
export function remove(
  stack: readonly OverlayStackEntry[],
  id: string,
): readonly OverlayStackEntry[] {
  return stack.filter((entry) => entry.id !== id);
}

export function derive(stack: readonly OverlayStackEntry[]): OverlayStackDerivation {
  let topActive: string | null = null;
  let depth = 0;
  for (const entry of stack) {
    if (!entry.active) continue;
    topActive = entry.id;
    depth += 1;
  }
  return { topActive, hostPresented: stack.length > 0, depth };
}
