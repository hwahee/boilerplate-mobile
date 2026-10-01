/**
 * The declarative door — opt-in, guarded by ESLint (docs/overlay-design.md §5.1).
 *
 * Overlays default to `useOverlay()`. These components exist for the cases the
 * registry cannot serve. On the app that is TWO of the web's three:
 *
 *   2. the body must keep re-rendering from live state (the registry's
 *      captured closure would go stale) — e.g. the Palette's sheet;
 *   3. always-visible layout — `<Sidebar modality="inline">`.
 *
 * The web's case 1 (a body needing a context from the SUBTREE it is called in)
 * is NOT available here: RN has no portals, so even a declarative overlay is
 * drawn by the host at the app root and sees only the root contexts. Pass what
 * the body needs as props (docs/overlay-mobile.md §3).
 *
 * Importing this module fails lint until you disable the rule on the import
 * line and say which case applies.
 */
import { useEffect, useId, useLayoutEffect } from 'react';

import { useOverlayHost } from './internal/host';
import { InlineSidebar } from './internal/InlineSidebar';
import type {
  BottomSheetProps,
  ModalProps,
  OverlayCommonProps,
  OverlayKind,
  SidebarProps,
} from './internal/types';

/**
 * Registers this overlay with the host on EVERY render (layout effect — before
 * paint, so a controlled input inside never lags a frame), and leaves the
 * stack when the component unmounts.
 */
function useDeclarativeOverlay(kind: OverlayKind, props: OverlayCommonProps & object): null {
  const host = useOverlayHost();
  const id = useId();
  const { open, onClose, onClosed, footer, children, ...presentation } = props;

  useLayoutEffect(() => {
    host.upsert({ id, kind, presentation, open, body: children, footer, onClose, onClosed });
  });

  const { drop } = host;
  useEffect(() => () => drop(id), [drop, id]);
  return null;
}

/** Centred dialog. `tone="danger"` announces as an alert. */
export function Modal(props: ModalProps) {
  return useDeclarativeOverlay('modal', props);
}

/** Sheet anchored to the bottom edge. */
export function BottomSheet(props: BottomSheetProps) {
  return useDeclarativeOverlay('sheet', props);
}

/** Edge panel: modal drawer, or (`modality="inline"`) docked layout in place. */
export function Sidebar({ modality = 'auto', ...props }: SidebarProps) {
  if (modality === 'inline') return <InlineSidebar {...props} />;
  return <ModalSidebar {...props} />;
}

function ModalSidebar(props: Omit<SidebarProps, 'modality'>) {
  return useDeclarativeOverlay('sidebar', props);
}
