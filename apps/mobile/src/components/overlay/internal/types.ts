/**
 * The overlay contract — declared ONCE, on the declarative props. The
 * imperative requests (registry.tsx) are derived from these types, so adding a
 * prop here adds it to `useOverlay()` too and the two doors cannot drift
 * (docs/overlay-design.md §5.4).
 */
import type { ReactNode } from 'react';

export interface OverlayLifecycle {
  /** Open state (controlled). */
  open: boolean;
  /**
   * Close REQUEST, not a command: the overlay never closes itself — the caller
   * lowers `open` — which is what makes "discard your changes?" possible.
   */
  onClose: () => void;
  /**
   * Fires once the exit animation has finished and nothing is on screen. Reset
   * the state the overlay was showing HERE, not in `onClose`.
   */
  onClosed?: () => void;
}

/** Props shared by all three overlays. Variant props are added on top. */
export interface OverlayCommonProps extends OverlayLifecycle {
  /** Accessible name — required (same contract as TextField / Palette). */
  title: string;
  /** Visually hides the title (it stays the accessible name). */
  hideTitle?: boolean;
  /** Scrim tap and Android back. Turn it off while there is unsaved input. Default true. */
  dismissable?: boolean;
  /** Footer actions, pinned below the scrolling body. */
  footer?: ReactNode;
  /**
   * App-only: `false` hands scrolling to the content (it lays out its own
   * scroll region, e.g. the Palette's grid with a callout floating above it).
   * Default true — the body is a ScrollBox.
   */
  scrollable?: boolean;
  /**
   * Required — every interactive element must be automatable
   * (docs/ui-automation-mobile.md). Derives `{testID}.panel`, `.title`, `.close`.
   */
  testID: string;
  children: ReactNode;
}

export interface ModalProps extends OverlayCommonProps {
  /** Width bucket. Default `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** `danger` marks a destructive decision and announces as an alert. */
  tone?: 'default' | 'danger';
}

export interface BottomSheetProps extends OverlayCommonProps {
  /** `content` hugs its content, `full` takes the tall snap (85% of the window). */
  snapPoint?: 'content' | 'full';
}

export interface SidebarProps extends OverlayCommonProps {
  /** Which edge it is anchored to. */
  side?: 'start' | 'end';
  /**
   * `modal` dims and owns back; `inline` is layout that claims nothing.
   * `auto` (default) is `modal` on every supported device — phones only
   * (docs/platform-decisions.md #3); the web's docked desktop presentation has
   * no phone counterpart.
   */
  modality?: 'auto' | 'modal' | 'inline';
}

export type OverlayKind = 'modal' | 'sheet' | 'sidebar';

/** What the host needs to present one entry — everything except its content. */
export type OverlayPresentation = Omit<
  ModalProps & BottomSheetProps & Omit<SidebarProps, 'modality'>,
  keyof OverlayLifecycle | 'children' | 'footer'
>;
