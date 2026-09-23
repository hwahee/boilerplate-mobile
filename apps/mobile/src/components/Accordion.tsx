/**
 * Accordion — app port of src/client/ui/accordion.tsx (same props, same
 * derived testIDs, same three layout-shift escape hatches).
 *
 *   `testID` is REQUIRED; per item it derives
 *     `${testID}.trigger.${id}` (the header button, a11y state `expanded`)
 *     `${testID}.panel.${id}`   (the collapsible region)
 *
 * Expanding inline content shifts everything below it. As on the web, the
 * component doesn't pretend otherwise and ships escape hatches:
 *
 *   0. The shift is ANIMATED (LayoutAnimation over `motion.durationExpand`) so
 *      the eye can track where content went. Skins keep authority: office's
 *      0ms toggles instantly, kids' overshooting curve becomes a spring, and
 *      OS "reduce motion" turns it off.
 *   1. The pressed trigger is ANCHORED and 2. an opened panel is REVEALED —
 *      one scroll correction computed from the final layout
 *      (accordion-scroll.ts). Needs an <AnchoredScrollView> ancestor; without
 *      one the corrections are skipped.
 *
 * Differences from the web, by platform: no ArrowUp/Down/Home/End roving
 * (phones have no keyboard focus model — screen-reader swipe order covers
 * it), and collapsed panels leave the accessibility tree immediately (hiding
 * from AT has no visual effect here, so there's nothing to wait for).
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  LayoutAnimation,
  Pressable,
  View,
  type LayoutAnimationConfig,
} from 'react-native';

import { useMotionProgress } from '../theme/motion';
import { accordionSkin } from '../theme/skin';
import { useTheme } from '../theme/ThemeProvider';
import type { Tokens } from '../theme/tokens';
import { planAccordionScroll } from './accordion-scroll';
import { useScrollAnchor } from './AnchoredScrollView';
import { AppText } from './AppText';

interface AccordionItem {
  /** Stable identity — also the segment used in the derived testIDs. */
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  /** `single` (classic accordion) closes the other items when one opens. */
  mode?: 'single' | 'multiple';
  /** Item ids that start open (the component is uncontrolled). */
  defaultOpenIds?: readonly string[];
  /** Required — from the TESTID registry (or `ds.*` on the design-system screen). */
  testID: string;
}

interface PendingToggle {
  id: string;
  /** Window-relative top of the pressed trigger at press time — the anchor. */
  triggerTopBefore: number;
  opened: boolean;
}

/** Escape hatch #0, shaped by the skin's motion tokens (null = instant). */
function expandAnimation(tokens: Tokens, reduceMotion: boolean): LayoutAnimationConfig | null {
  const { durationExpand, easing } = tokens.motion;
  if (reduceMotion || durationExpand === 0) return null;
  // A curve whose control points leave [0, 1] overshoots (kids) — the native
  // equivalent is a spring.
  const overshoots = easing[1] > 1 || easing[3] > 1;
  return overshoots
    ? {
        duration: durationExpand,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'spring', springDamping: 0.55 },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      }
    : LayoutAnimation.create(durationExpand, 'easeInEaseOut', 'opacity');
}

export function Accordion({ items, mode = 'single', defaultOpenIds, testID }: AccordionProps) {
  const { tokens, reduceMotion } = useTheme();
  const anchor = useScrollAnchor();
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set(defaultOpenIds ?? []));
  const triggerRefs = useRef(new Map<string, View>());
  const panelRefs = useRef(new Map<string, View>());
  const pendingRef = useRef<PendingToggle | null>(null);
  const skin = accordionSkin(tokens);

  const toggle = (id: string) => {
    const opened = !openIds.has(id);
    const apply = (triggerTopBefore: number | null) => {
      if (triggerTopBefore !== null) pendingRef.current = { id, triggerTopBefore, opened };
      const animation = expandAnimation(tokens, reduceMotion);
      if (animation) LayoutAnimation.configureNext(animation);
      setOpenIds((current) => {
        if (mode === 'single') return opened ? new Set([id]) : new Set<string>();
        const next = new Set(current);
        if (opened) next.add(id);
        else next.delete(id);
        return next;
      });
    };
    const trigger = triggerRefs.current.get(id);
    if (anchor && trigger) trigger.measureInWindow((_x, y) => apply(y));
    else apply(null);
  };

  // Escape hatches #1 + #2: the committed layout is final even while the
  // native animation still plays, so one measured correction covers both.
  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (!pending || !anchor) return;
    pendingRef.current = null;
    const trigger = triggerRefs.current.get(pending.id);
    const panel = panelRefs.current.get(pending.id);
    if (!trigger || !panel) return;
    const animated = expandAnimation(tokens, reduceMotion) !== null;

    trigger.measureInWindow((_tx, triggerTopAfter) => {
      panel.measureInWindow((_px, panelTop, _pw, panelHeight) => {
        anchor.measureViewport((viewportTop, viewportBottom) => {
          const dy = planAccordionScroll({
            triggerTopBefore: pending.triggerTopBefore,
            triggerTopAfter,
            panelBottomAfter: panelTop + panelHeight,
            viewportTop,
            viewportBottom,
            opened: pending.opened,
          });
          anchor.scrollBy(dy, animated);
        });
      });
    });
  }, [openIds, anchor, tokens, reduceMotion]);

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: tokens.colors.surface,
        borderWidth: tokens.borderWidth,
        borderColor: tokens.colors.border,
        borderRadius: tokens.radius.surface,
        overflow: 'hidden',
        ...(tokens.surfaceShadow ? { boxShadow: tokens.surfaceShadow } : null),
      }}
    >
      {items.map((item, index) => {
        const open = openIds.has(item.id);
        return (
          <View
            key={item.id}
            style={
              index > 0
                ? { borderTopWidth: tokens.borderWidth, borderTopColor: skin.separatorColor }
                : undefined
            }
          >
            <Pressable
              testID={`${testID}.trigger.${item.id}`}
              ref={(el) => {
                if (el) triggerRefs.current.set(item.id, el);
                else triggerRefs.current.delete(item.id);
              }}
              onPress={() => toggle(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                minHeight: tokens.controlHeight,
                paddingVertical: 12,
                paddingHorizontal: tokens.spacing.md,
                backgroundColor: pressed ? tokens.colors.surfaceAlt : 'transparent',
                ...skin.trigger,
              })}
            >
              <AppText bold style={{ flex: 1, fontWeight: skin.titleWeight ?? '600' }}>
                {item.title}
              </AppText>
              <Chevron open={open} />
            </Pressable>
            <View
              testID={`${testID}.panel.${item.id}`}
              ref={(el) => {
                if (el) panelRefs.current.set(item.id, el);
                else panelRefs.current.delete(item.id);
              }}
              accessibilityElementsHidden={!open}
              importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
              style={open ? { overflow: 'hidden' } : { height: 0, overflow: 'hidden' }}
            >
              <View
                style={{
                  paddingTop: tokens.spacing.xs,
                  paddingHorizontal: tokens.spacing.md,
                  paddingBottom: tokens.spacing.md,
                }}
              >
                {item.content}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** State shown by rotating the chevron — transform only, the row never reflows. */
function Chevron({ open }: { open: boolean }) {
  const { tokens } = useTheme();
  const turn = useMotionProgress(open ? 1 : 0);
  const { animateTo } = turn;

  useEffect(() => {
    animateTo(open ? 1 : 0);
  }, [open, animateTo]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: turn.progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '180deg'],
            }),
          },
        ],
      }}
    >
      <Ionicons
        name="chevron-down"
        size={Math.round(tokens.type.body * 1.25)}
        color={tokens.colors.text}
      />
    </Animated.View>
  );
}
