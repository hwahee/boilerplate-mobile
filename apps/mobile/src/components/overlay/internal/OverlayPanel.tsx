/**
 * The shell every overlay shares — app port of overlay-shell.tsx. Modal /
 * BottomSheet / Sidebar differ only in where the panel sits and how it moves.
 *
 * Closing is a transaction, not an event (docs/overlay-design.md §4): when
 * `open` drops, the panel animates out on the SKIN's clock (tokens.motion —
 * office 0ms, kids overshoot, OS reduce-motion instant) and only then reports
 * `onClosed`. Re-opening mid-close stops the exit animation, so the pending
 * `onClosed` never fires against the overlay that is open again (§4.4).
 *
 * Holds no React state: the animation lives in an Animated.Value and every
 * transition is an effect, so a close never re-renders the tree that opened it.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale } from '../../../i18n/LocaleProvider';
import { useTheme } from '../../../theme/ThemeProvider';
import { AppText } from '../../AppText';
import { IconButton } from '../../IconButton';
import { ScrollBox } from '../../ScrollBox';
import type { OverlayKind, OverlayPresentation } from './types';

export interface OverlayPanelProps {
  kind: OverlayKind;
  presentation: OverlayPresentation;
  open: boolean;
  /** Top of the stack: owns accessibility focus; everything below is hidden from AT. */
  isTop: boolean;
  body: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  onClosed: () => void;
}

export function OverlayPanel({
  kind,
  presentation,
  open,
  isTop,
  body,
  footer,
  onClose,
  onClosed,
}: OverlayPanelProps) {
  const { tokens, reduceMotion } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const titleRef = useRef<View>(null);
  const titleId = useId();

  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });

  const { durationFast, easing } = tokens.motion;
  const instant = reduceMotion || durationFast === 0;

  useEffect(() => {
    const target = open ? 1 : 0;
    if (instant) {
      progress.setValue(target);
      if (!open) onClosedRef.current();
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: target,
      duration: durationFast,
      easing: Easing.bezier(...easing),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      // Not finished = stopped by a re-open: the close was cancelled.
      if (finished && !open) onClosedRef.current();
    });
    return () => animation.stop();
  }, [open, instant, durationFast, easing, progress]);

  // Screen readers start at the title, not at "close" (§9).
  useEffect(() => {
    if (open && isTop && titleRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }
  }, [open, isTop]);

  const { colors, radius, overlay } = tokens;
  const side = presentation.side ?? 'start';
  const danger = kind === 'modal' && presentation.tone === 'danger';

  // Placement of the full-window layer for this entry.
  const layer: ViewStyle =
    kind === 'modal'
      ? { alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.md }
      : kind === 'sheet'
        ? { alignItems: 'center', justifyContent: 'flex-end' }
        : { alignItems: side === 'end' ? 'flex-end' : 'flex-start' };

  const width = { sm: overlay.widthSm, md: overlay.widthMd, lg: overlay.widthLg }[
    presentation.size ?? 'md'
  ];
  const sheetHeight = window.height * overlay.sheetMaxHeight;

  const panelShape: ViewStyle =
    kind === 'modal'
      ? { width: '100%', maxWidth: width, maxHeight: '100%', borderRadius: radius.surface }
      : kind === 'sheet'
        ? {
            width: '100%',
            maxWidth: overlay.widthLg,
            maxHeight: sheetHeight,
            ...(presentation.snapPoint === 'full' ? { height: sheetHeight } : null),
            borderTopLeftRadius: radius.surface,
            borderTopRightRadius: radius.surface,
            borderBottomWidth: 0,
            paddingBottom: tokens.spacing.md + insets.bottom,
          }
        : {
            width: overlay.sidebarWidth,
            maxWidth: '100%',
            height: '100%',
            borderRadius: 0,
            paddingTop: tokens.spacing.md + insets.top,
            paddingBottom: tokens.spacing.md + insets.bottom,
          };

  // Each variant's entrance — the web's @starting-style values.
  const motion =
    kind === 'modal'
      ? {
          opacity: progress,
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
          ],
        }
      : kind === 'sheet'
        ? {
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [sheetHeight, 0],
                }),
              },
            ],
          }
        : {
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [side === 'end' ? overlay.sidebarWidth : -overlay.sidebarWidth, 0],
                }),
              },
            ],
          };

  const scrollable = presentation.scrollable ?? true;
  const { testID } = presentation;

  return (
    <View
      // The overlay itself — present while open or animating out, gone after.
      testID={testID}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, layer]}
      pointerEvents="box-none"
    >
      <Animated.View
        testID={`${testID}.panel`}
        // Only the top overlay is reachable by assistive tech; the ones below
        // sit behind the scrim (the app behind is hidden by the native host).
        accessibilityViewIsModal={isTop}
        accessibilityElementsHidden={!isTop}
        importantForAccessibility={isTop ? 'auto' : 'no-hide-descendants'}
        accessibilityRole={danger ? 'alert' : undefined}
        aria-labelledby={titleId}
        style={[
          {
            // The body is a ScrollBox whose bleed is a negative margin; adding
            // it back keeps the visible gap at 12 (web: .overlay__panel gap).
            gap: 12 + overlay.scrollBleed,
            padding: tokens.spacing.md,
            backgroundColor: colors.surfaceAlt,
            borderWidth: tokens.borderWidth,
            borderColor: danger ? colors.danger : colors.border,
            ...(tokens.surfaceShadow ? { boxShadow: tokens.surfaceShadow } : null),
          },
          panelShape,
          motion,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          {/* The accessible title — focus lands here on open. */}
          <View
            ref={titleRef}
            testID={`${testID}.title`}
            nativeID={titleId}
            accessible
            accessibilityRole="header"
            style={
              presentation.hideTitle
                ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }
                : { flex: 1 }
            }
          >
            <AppText variant="heading">{presentation.title}</AppText>
          </View>
          <IconButton
            testID={`${testID}.close`}
            accessibilityLabel={t('common.close')}
            icon="close"
            color={colors.textMuted}
            onPress={onClose}
          />
        </View>

        {scrollable ? (
          <ScrollBox style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollBox>
        ) : (
          <View style={{ flexShrink: 1 }}>{body}</View>
        )}

        {footer ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: tokens.spacing.sm,
              justifyContent: 'flex-end',
            }}
          >
            {footer}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}
