/**
 * The imperative door — the default way to open an overlay (app port of the
 * web registry.tsx, docs/overlay-design.md §5).
 *
 *   const answer = await overlay.modal<boolean>({ title, testID, render });
 *
 * The caller passes only the body; the host draws the shell, so `title` and
 * `testID` are required ARGUMENTS of the call. Request types derive from the
 * declarative props, so the two doors cannot drift. The promise never
 * rejects: dismissing resolves `undefined`.
 */
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import { useOverlayHost, type HostEntry } from './internal/host';
import type {
  BottomSheetProps,
  ModalProps,
  OverlayKind,
  OverlayLifecycle,
  OverlayPresentation,
  SidebarProps,
} from './internal/types';

interface OverlayApi<R> {
  /** Dismiss with no answer — the promise resolves to `undefined`. */
  close: () => void;
  /** Answer and dismiss. */
  resolve: (value: R) => void;
}

/** Props the host owns; a caller never passes these. */
type ShellOwned = keyof OverlayLifecycle | 'children' | 'footer';

type OverlayRequest<P, R> = Omit<P, ShellOwned> & {
  render: (api: OverlayApi<R>) => ReactNode;
  /** Footer actions — a render function: the answering buttons need `resolve` too. */
  renderFooter?: (api: OverlayApi<R>) => ReactNode;
};

export interface Overlay {
  modal: <R = void>(request: OverlayRequest<ModalProps, R>) => Promise<R | undefined>;
  sheet: <R = void>(request: OverlayRequest<BottomSheetProps, R>) => Promise<R | undefined>;
  /** No `modality`: a sidebar opened through the registry is a popup by definition. */
  sidebar: <R = void>(
    request: OverlayRequest<Omit<SidebarProps, 'modality'>, R>,
  ) => Promise<R | undefined>;
}

let nextId = 0;

/**
 * Opens overlays. Anything this component opened is closed when it unmounts,
 * so an `await` left hanging by a navigation resolves to `undefined`.
 */
export function useOverlay(): Overlay {
  const host = useOverlayHost();
  const owner = useId();
  /** Live entries this instance opened: id → its close function. */
  const opened = useRef(new Map<string, () => void>());

  useEffect(() => {
    const live = opened.current;
    return () => {
      for (const close of live.values()) close();
    };
  }, [owner]);

  const open = useCallback(
    (kind: OverlayKind) =>
      ({
        render,
        renderFooter,
        ...presentation
      }: OverlayRequest<OverlayPresentation, unknown>): Promise<unknown> => {
        nextId += 1;
        const id = `overlay-${String(nextId)}`;
        return new Promise((settle) => {
          let answer: unknown;
          let closed = false;
          // Idempotent: the first answer wins (a later close() — e.g. the
          // owner unmounting — must not overwrite a value already given).
          const close = (value?: unknown) => {
            if (closed) return;
            closed = true;
            answer = value;
            opened.current.delete(id);
            host.upsert({ ...entry, open: false });
          };
          const api: OverlayApi<unknown> = { close: () => close(), resolve: close };
          // Declared after `close`, which only runs once the user acts.
          const entry: HostEntry = {
            id,
            kind,
            presentation,
            open: true,
            body: render(api),
            footer: renderFooter?.(api),
            onClose: () => close(),
            // Resolution waits for the exit animation, so the caller's next
            // line never runs while the overlay it acted on is still on screen.
            onClosed: () => settle(answer),
          };
          opened.current.set(id, () => close());
          host.upsert(entry);
        });
      },
    [host],
  );

  return useMemo(
    () => ({ modal: open('modal'), sheet: open('sheet'), sidebar: open('sidebar') }) as Overlay,
    [open],
  );
}
