/**
 * TEMPORARY bottom sheet for the Palette.
 *
 * The web opens the palette as an anchored popover; on a phone the idiom is a
 * bottom sheet (room for the grid, the hex field and the keyboard). The proper
 * sheet arrives with upstream PR #8 (the overlay family: Modal / BottomSheet /
 * Sidebar and the stack that arbitrates scrim, focus and back handling). Until
 * that is ported, this minimal RN-Modal sheet stands in — and the Palette is
 * written against the small surface below so the swap is local.
 *
 * Known limits (all resolved by the #8 overlay stack):
 *   - one level only: opening another overlay on top is not arbitrated;
 *   - no drag-to-dismiss (scrim tap, the close button and Android back close it).
 */
import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale } from '../../i18n/LocaleProvider';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText } from '../AppText';
import { IconButton } from '../IconButton';

export interface TemporarySheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** The sheet surface gets `testID`; the close button `${testID}.close`. */
  testID: string;
  /** Skin overrides for the surface (e.g. office's raised bevel). */
  surfaceStyle?: ViewStyle;
  padding: number;
}

export function TemporarySheet({
  visible,
  onClose,
  title,
  testID,
  surfaceStyle,
  padding,
  children,
}: TemporarySheetProps) {
  const { tokens, reduceMotion } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const animated = !reduceMotion && tokens.motion.durationFast > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animated ? 'fade' : 'none'}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        // The hex field must stay above the keyboard (Android resizes the
        // window itself).
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        {/* Scrim: tap outside = close without changing the value (web: light dismiss). */}
        <Pressable
          style={{ flex: 1, backgroundColor: tokens.colors.overlay }}
          onPress={onClose}
          accessible={false}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={{
            maxHeight: '85%',
            backgroundColor: tokens.colors.surfaceAlt,
            borderColor: tokens.colors.border,
            borderWidth: tokens.borderWidth,
            borderBottomWidth: 0,
            borderTopLeftRadius: tokens.radius.surface,
            borderTopRightRadius: tokens.radius.surface,
            padding,
            paddingBottom: padding + insets.bottom,
            ...(tokens.surfaceShadow ? { boxShadow: tokens.surfaceShadow } : null),
            ...surfaceStyle,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: tokens.spacing.sm,
            }}
          >
            <AppText bold accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
              {title}
            </AppText>
            <IconButton
              testID={`${testID}.close`}
              accessibilityLabel={t('common.close')}
              icon="close"
              onPress={onClose}
            />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
