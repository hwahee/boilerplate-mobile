/**
 * ScrollView that lets descendants correct its scroll position — what the web
 * gets for free from `window.scrollBy`. The accordion uses it to keep a pressed
 * trigger in place and to reveal an opened panel (see accordion-scroll.ts).
 *
 * Opt-in: an accordion outside one of these simply skips the corrections.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';

export interface ScrollAnchor {
  /** Scroll by `dy` points (positive = content moves up). */
  scrollBy: (dy: number, animated: boolean) => void;
  /** Window-relative top/bottom of the visible scroll area. */
  measureViewport: (callback: (top: number, bottom: number) => void) => void;
}

const ScrollAnchorContext = createContext<ScrollAnchor | null>(null);

export function useScrollAnchor(): ScrollAnchor | null {
  return useContext(ScrollAnchorContext);
}

export interface AnchoredScrollViewProps extends PropsWithChildren {
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function AnchoredScrollView({ contentContainerStyle, children }: AnchoredScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null);
  // The frame is measured on a wrapping View: it has exactly the ScrollView's
  // bounds, and View's measureInWindow is typed (ScrollView's is not).
  const frameRef = useRef<View>(null);
  const offset = useRef(0);

  const scrollBy = useCallback((dy: number, animated: boolean) => {
    if (dy === 0) return;
    offset.current = Math.max(0, offset.current + dy);
    scrollRef.current?.scrollTo({ y: offset.current, animated });
  }, []);

  const measureViewport = useCallback((callback: (top: number, bottom: number) => void) => {
    frameRef.current?.measureInWindow((_x, y, _width, height) => callback(y, y + height));
  }, []);

  const anchor = useMemo(() => ({ scrollBy, measureViewport }), [scrollBy, measureViewport]);

  return (
    <ScrollAnchorContext.Provider value={anchor}>
      <View ref={frameRef} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={contentContainerStyle}
          scrollEventThrottle={16}
          onScroll={(event) => {
            offset.current = event.nativeEvent.contentOffset.y;
          }}
        >
          {children}
        </ScrollView>
      </View>
    </ScrollAnchorContext.Provider>
  );
}
