/**
 * The overlay host and registry — every open overlay, from either door, is an
 * entry here, which is what makes a declarative sheet and an imperative
 * confirm on top of it behave as one stack.
 *
 * ONE native layer for the whole stack (docs/overlay-mobile.md §2). On iOS an
 * RN <Modal> presents from the view controller that owns it, so two sibling
 * Modals cannot stack — the second finds the root controller already busy.
 * Rather than requiring overlays to be nested in each other's JSX, the host
 * presents a single transparent Modal while any entry exists and draws every
 * overlay inside it in stack order. That is the app's version of the web's
 * "the stack owns the top layer": z-order without z-index, one place for the
 * scrim, one handler for Android back.
 *
 * The rules (who paints the scrim, who answers back, when the layer may go)
 * are derived by ../overlay-stack.ts — pure and unit-tested.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable } from 'react-native';

import { env } from '../../../config/env';
import { useTheme } from '../../../theme/ThemeProvider';
import { derive, NESTING_WARN_DEPTH } from '../overlay-stack';
import { OverlayPanel } from './OverlayPanel';
import type { OverlayKind, OverlayPresentation } from './types';

/** One overlay as the host presents it — everything already resolved to nodes. */
export interface HostEntry {
  id: string;
  kind: OverlayKind;
  presentation: OverlayPresentation;
  open: boolean;
  body: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  /** Called once the exit animation finished; the host drops the entry after. */
  onClosed?: () => void;
}

interface HostValue {
  /** Add or update an entry; an absent entry with `open: false` is ignored. */
  upsert: (entry: HostEntry) => void;
  /** Remove at once (the declaring component unmounted). */
  drop: (id: string) => void;
}

const HostContext = createContext<HostValue | null>(null);

export function useOverlayHost(): HostValue {
  const value = useContext(HostContext);
  if (!value) {
    throw new Error(
      'Overlays need <OverlayProvider> above them (App.tsx) — see docs/overlay-mobile.md.',
    );
  }
  return value;
}

function upsertInto(entries: readonly HostEntry[], next: HostEntry): readonly HostEntry[] {
  const index = entries.findIndex((entry) => entry.id === next.id);
  if (index < 0) return next.open ? [...entries, next] : entries;
  const previous = entries[index]!;
  // Re-opened while closing → back to the top of the stack (overlay-stack `open`).
  if (next.open && !previous.open) {
    return [...entries.filter((entry) => entry.id !== next.id), next];
  }
  return entries.map((entry) => (entry.id === next.id ? next : entry));
}

export function OverlayHostProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly HostEntry[]>([]);

  const upsert = useCallback((entry: HostEntry) => {
    setEntries((current) => upsertInto(current, entry));
  }, []);
  const drop = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const value = useMemo<HostValue>(() => ({ upsert, drop }), [upsert, drop]);

  const { topActive, hostPresented, depth } = derive(
    entries.map((entry) => ({ id: entry.id, active: entry.open })),
  );

  useEffect(() => {
    if (!env.isDev || depth <= NESTING_WARN_DEPTH) return;
    console.warn(
      `[overlay] ${depth} overlays are stacked. Nesting is allowed (a confirm over a form ` +
        `modal is legitimate) but this deep usually means a flow that should be one overlay.`,
    );
  }, [depth]);

  const top = entries.find((entry) => entry.id === topActive);
  const dismissTop = () => {
    if (top && top.presentation.dismissable !== false) top.onClose();
  };

  // Exactly one scrim, directly under the top active overlay. When the last one
  // starts closing there is no owner: the scrim stays under the top entry and
  // fades out with it.
  const scrimAnchor = topActive ?? entries[entries.length - 1]?.id;
  const layers: ReactNode[] = [];
  for (const entry of entries) {
    if (entry.id === scrimAnchor) {
      layers.push(<Scrim key="scrim" visible={topActive !== null} onPress={dismissTop} />);
    }
    layers.push(
      <OverlayPanel
        key={entry.id}
        kind={entry.kind}
        presentation={entry.presentation}
        open={entry.open}
        isTop={entry.id === topActive}
        body={entry.body}
        footer={entry.footer}
        onClose={entry.onClose}
        onClosed={() => {
          entry.onClosed?.();
          drop(entry.id);
        }}
      />,
    );
  }

  return (
    <HostContext.Provider value={value}>
      {children}
      <Modal
        visible={hostPresented}
        transparent
        // Every panel animates itself on the skin's clock; the layer is instant.
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        // Android back answers the top overlay only — LIFO, one at a time.
        onRequestClose={dismissTop}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {layers}
        </KeyboardAvoidingView>
      </Modal>
    </HostContext.Provider>
  );
}

/** The one scrim. A tap dismisses the overlay directly above it. */
function Scrim({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const { tokens, reduceMotion } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0));
  const { durationFast, easing } = tokens.motion;
  const instant = reduceMotion || durationFast === 0;

  useEffect(() => {
    const target = visible ? 1 : 0;
    if (instant) {
      opacity.setValue(target);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: target,
      duration: durationFast,
      easing: Easing.bezier(...easing),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, instant, durationFast, easing, opacity]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: tokens.colors.overlay,
        opacity,
      }}
    >
      {/* RN only fires onPress for a press that STARTED here, so a drag that
          merely ends on the scrim never dismisses (the web needs a guard). */}
      <Pressable style={{ flex: 1 }} accessible={false} onPress={onPress} />
    </Animated.View>
  );
}
