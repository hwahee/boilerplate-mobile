/**
 * Docked sidebar (`modality="inline"`) — layout, not a popup: drawn in place,
 * no host, no scrim, never joins the stack.
 *
 * It shares the panel's look but none of the drawer's motion. That separation
 * is upstream #12's lesson: on the web the docked panel inherited the drawer's
 * closed-state transform (an <aside> never has `open`) and sat a full width
 * off its own box. Here the two presentations are different components, so
 * there is no shared closed-state rule to leak.
 *
 * Shown and hidden without a transition: a region of the page appearing has no
 * exit animation to outlive, so `onClosed` follows `onClose` directly.
 */
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { useLocale } from '../../../i18n/LocaleProvider';
import { useTheme } from '../../../theme/ThemeProvider';
import { AppText } from '../../AppText';
import { IconButton } from '../../IconButton';
import { ScrollBox } from '../../ScrollBox';
import type { SidebarProps } from './types';

export function InlineSidebar({
  open,
  onClose,
  onClosed,
  title,
  hideTitle = false,
  footer,
  scrollable = true,
  testID,
  children,
}: Omit<SidebarProps, 'modality' | 'side'>) {
  const { tokens } = useTheme();
  const { t } = useLocale();

  const wasOpen = useRef(open);
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });
  useEffect(() => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    if (!open) onClosedRef.current?.();
  }, [open]);

  if (!open) return null;

  const { colors, overlay } = tokens;
  return (
    <View
      testID={testID}
      accessibilityRole="none"
      style={{ width: overlay.sidebarWidth, maxWidth: '100%' }}
    >
      <View
        testID={`${testID}.panel`}
        style={{
          gap: 12 + overlay.scrollBleed,
          padding: tokens.spacing.md,
          backgroundColor: colors.surfaceAlt,
          borderWidth: tokens.borderWidth,
          borderColor: colors.border,
          borderRadius: tokens.radius.surface,
          ...(tokens.surfaceShadow ? { boxShadow: tokens.surfaceShadow } : null),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View
            testID={`${testID}.title`}
            accessible
            accessibilityRole="header"
            style={
              hideTitle
                ? { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 }
                : { flex: 1 }
            }
          >
            <AppText variant="heading">{title}</AppText>
          </View>
          <IconButton
            testID={`${testID}.close`}
            accessibilityLabel={t('common.close')}
            icon="close"
            color={colors.textMuted}
            onPress={onClose}
          />
        </View>
        {scrollable ? <ScrollBox>{children}</ScrollBox> : <View>{children}</View>}
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
      </View>
    </View>
  );
}
