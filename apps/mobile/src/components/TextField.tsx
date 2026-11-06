/**
 * Text input. `testID` is REQUIRED; when an error is shown, an
 * `${testID}.error` element appears (automation waits on it) and screen
 * readers announce it via the live region. TextArea (./TextArea.tsx) is the
 * multi-line sibling with the same contract — both render `Field` below.
 *
 * Skins (theme/skin.ts): office is a sunken bevel with the dotted focus
 * rectangle; kids pops (scale + overshoot) and glows while focused.
 */
import { useState } from 'react';
import { Animated, TextInput, View, type TextInputProps } from 'react-native';

import { useMotionProgress } from '../theme/motion';
import { fieldSkin } from '../theme/skin';
import { useInsideScrollBox } from './ScrollBox';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

export interface TextFieldProps {
  /** Required — from the TESTID registry only. */
  testID: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Visible label above the field; also the accessibility name. */
  label?: string;
  placeholder?: string;
  error?: string | null;
  onSubmitEditing?: () => void;
  returnKeyType?: TextInputProps['returnKeyType'];
  autoFocus?: boolean;
  editable?: boolean;
  /** Fires after the field loses focus (e.g. to commit a draft value). */
  onBlur?: () => void;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
}

export function TextField(props: TextFieldProps) {
  return <Field {...props} />;
}

/** What TextArea adds on top of the single-line field. */
export interface MultilineOptions {
  /** Visible lines before the box grows no further (web `rows`). */
  rows: number;
  maxLength?: number;
  /** Quiet line under the field, e.g. a character count → `${testID}.hint`. */
  hint?: string;
}

/** @internal — shared by TextField and TextArea; not part of the public API. */
export function Field({
  testID,
  value,
  onChangeText,
  label,
  placeholder,
  error,
  onSubmitEditing,
  returnKeyType,
  autoFocus,
  editable = true,
  onBlur: onBlurProp,
  autoCapitalize,
  autoCorrect,
  multiline,
}: TextFieldProps & { multiline?: MultilineOptions }) {
  const { tokens, reduceMotion } = useTheme();
  const { colors } = tokens;
  const hasError = !!error;
  const [focused, setFocused] = useState(false);
  const pop = useMotionProgress();
  // Scale-up is size-proportional growth: off inside a ScrollBox (see there).
  const insideScrollBox = useInsideScrollBox();
  const pops = tokens.motion.focusScale !== 1 && !reduceMotion && !insideScrollBox;
  const lineHeight = Math.round(tokens.type.body * 1.5);

  const onFocus = () => {
    setFocused(true);
    if (pops) pop.animateTo(1);
  };
  const onBlur = () => {
    setFocused(false);
    if (pops) pop.animateTo(0);
    onBlurProp?.();
  };

  return (
    <View style={{ gap: tokens.spacing.xs }}>
      {label ? (
        <AppText variant="caption" bold muted>
          {label}
        </AppText>
      ) : null}
      <Animated.View
        style={
          pops
            ? {
                transform: [
                  {
                    scale: pop.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, tokens.motion.focusScale],
                    }),
                  },
                ],
              }
            : undefined
        }
      >
        <TextInput
          testID={testID}
          onFocus={onFocus}
          onBlur={onBlur}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoFocus={autoFocus}
          editable={editable}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          multiline={!!multiline}
          numberOfLines={multiline?.rows}
          maxLength={multiline?.maxLength}
          textAlignVertical={multiline ? 'top' : undefined}
          accessibilityLabel={label ?? placeholder}
          accessibilityState={{ disabled: !editable }}
          style={{
            borderWidth: tokens.borderWidth,
            borderColor: hasError ? colors.danger : colors.border,
            paddingHorizontal: tokens.controlPaddingX,
            ...(multiline
              ? {
                  // Grows with its rows instead of the control height (web
                  // .field__input--multiline). A tall box is a surface, not a
                  // pill: the kids pill radius would bend it into a capsule.
                  minHeight: multiline.rows * lineHeight + tokens.spacing.sm * 2,
                  paddingVertical: tokens.spacing.sm,
                  lineHeight,
                  borderRadius: Math.min(tokens.radius.control, tokens.radius.surface),
                }
              : {
                  minHeight: tokens.controlHeight,
                  borderRadius: tokens.radius.control,
                  // Compact (office) inputs: drop the platform's default
                  // vertical padding so 13pt text fits the 28pt box.
                  paddingVertical: tokens.controlHeight < tokens.minTouchTarget ? 0 : undefined,
                }),
            fontSize: tokens.type.body,
            fontFamily: tokens.type.fontFamily,
            color: colors.text,
            backgroundColor: colors.surface,
            ...fieldSkin(tokens, { focused }),
          }}
        />
      </Animated.View>
      {multiline?.hint ? (
        <AppText testID={`${testID}.hint`} variant="caption" muted>
          {multiline.hint}
        </AppText>
      ) : null}
      {hasError ? (
        <AppText
          testID={`${testID}.error`}
          variant="caption"
          color={colors.danger}
          accessibilityRole="text"
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
