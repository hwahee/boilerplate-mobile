/**
 * Scroll region that leaves room for its children's interaction states — the
 * app's port of the web `.scroll-box` (upstream #9, docs/overlay-design.md
 * §10.1).
 *
 * A ScrollView clips at its edge, so a child's focus ring, glow or pop gets
 * sliced exactly where it touches the edge. Growth comes in two kinds, and
 * each needs its own answer:
 *
 *   1. CONSTANT growth (focus ring, glow, shadow): the bleed — pad the content
 *      by `overlay.scrollBleed` and pull the box back out by the same amount,
 *      so there is room without moving where the content sits.
 *   2. Growth PROPORTIONAL to the child's size (scale-up pops): no fixed
 *      reservation can contain it, so inside a scroll box it is switched off.
 *      Components ask `useInsideScrollBox()` — the app's version of the web
 *      box neutralising --focus-scale / --hover-scale for its subtree. The
 *      kids press squish SHRINKS, can never overflow, and is kept.
 *
 * Layouts that put a scroll box between other elements add the bleed back to
 * their own gap (the negative margin would otherwise swallow it).
 */
import { createContext, useContext, type PropsWithChildren } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

const InsideScrollBoxContext = createContext(false);

/** True inside a ScrollBox: size-proportional growth (scale-up pops) is off. */
export function useInsideScrollBox(): boolean {
  return useContext(InsideScrollBoxContext);
}

export type ScrollBoxProps = PropsWithChildren<
  Pick<
    ScrollViewProps,
    'contentContainerStyle' | 'style' | 'keyboardShouldPersistTaps' | 'onScrollBeginDrag'
  >
>;

export function ScrollBox({ children, style, contentContainerStyle, ...rest }: ScrollBoxProps) {
  const { tokens } = useTheme();
  const bleed = tokens.overlay.scrollBleed;
  return (
    <ScrollView
      {...rest}
      style={[{ margin: -bleed, flexGrow: 0 }, style]}
      contentContainerStyle={[{ padding: bleed }, contentContainerStyle]}
    >
      <InsideScrollBoxContext.Provider value>{children}</InsideScrollBoxContext.Provider>
    </ScrollView>
  );
}
