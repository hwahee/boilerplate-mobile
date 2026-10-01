/**
 * Palette — app port of the web color input (src/client/ui/palette.tsx,
 * design: docs/palette-design.md; app decisions: docs/palette-mobile.md).
 *
 * Same contract as the web: controlled `value`/`onChange` with canonical
 * `HexColor` strings, `onPreview` for live values, `recent` owned by the
 * caller, required swatch names, and the three-tier selection
 *   L1 presets (shared set: @shared/color/presets)
 *   L2 hex field (always)
 *   L3 system picker (iOS only — Android has none; the button is hidden)
 *
 * What changes on a phone, and why:
 *   - Anchored popover → a BottomSheet on the overlay stack (components/overlay).
 *     A phone has no room beside the trigger, and the hex field needs space
 *     above the keyboard. Inside another overlay it simply stacks on top.
 *   - Hover tooltip → press-and-hold callout. Touch has no hover, so the name
 *     and the exact returned string show while the finger is DOWN, above the
 *     finger; releasing commits and closes, sliding off cancels.
 *   - Arrow-key grid navigation → none (no keyboard focus model); screen
 *     readers swipe through swatches announced as "name (value)".
 *
 * `testID` is REQUIRED and derives:
 *   `${testID}` trigger · `.sheet` (+ `.sheet.close`) · `.swatch.<hex without #>`
 *   · `.hex` (+ `.hex.error`) · `.native` (iOS) · `.contrast`
 */
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { contrastRatio, hexColor, parseHexColor, type HexColor } from '@shared/color';
import {
  DEFAULT_PALETTE_GROUPS,
  type PaletteGroup,
  type PaletteSwatch,
} from '@shared/color/presets';

import { useLocale } from '../i18n/LocaleProvider';
import { useMotionProgress } from '../theme/motion';
import { paletteSkin, touchSlop, type PaletteSkin } from '../theme/skin';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- live content: the sheet shows this component's draft, error and callout state as it changes
import { BottomSheet } from './overlay/declarative';
import { placeCallout, type Box } from './palette/callout';
import { Checker } from './palette/Checker';
import { nativeColorPickerAvailable, pickNativeColor } from './palette/native-picker';
import { ScrollBox, useInsideScrollBox } from './ScrollBox';
import { TextField } from './TextField';

export interface PaletteProps {
  /** Always rendered as a real label — required (same contract as TextField). */
  label: string;
  /** Current color (controlled). */
  value: HexColor;
  /** Committed changes only. Live values from the system picker arrive via `onPreview`. */
  onChange: (value: HexColor) => void;
  /** Preset groups. Defaults to the shared 32-color set. */
  presets?: readonly PaletteGroup[];
  /** Recently used colors, appended as their own group. Persisting them is the caller's job. */
  recent?: readonly PaletteSwatch[];
  /** Shows the hex field and (iOS) the system picker. Default true. */
  allowCustom?: boolean;
  /** Live value while the system picker is being dragged. */
  onPreview?: (value: HexColor) => void;
  /** Warn when the value fails WCAG AA against this background. */
  contrastAgainst?: HexColor;
  /** Required — from the TESTID registry (or `ds.*` on the design-system screen). */
  testID: string;
  disabled?: boolean;
  /** Hides the visible label (it stays the accessible name). */
  hideLabel?: boolean;
}

/** WCAG AA for normal text. */
const MIN_CONTRAST = 4.5;
const LIGHT_INK = hexColor('#ffffff');
const DARK_INK = hexColor('#000000');

/** Ink that survives on both a white and a black swatch. */
function inkFor(color: HexColor): HexColor {
  return contrastRatio(LIGHT_INK, color) >= contrastRatio(DARK_INK, color) ? LIGHT_INK : DARK_INK;
}

function isTranslucent(color: HexColor): boolean {
  return color.length === 9;
}

interface CalloutTarget {
  swatch: PaletteSwatch;
  anchor: Box;
}

export function Palette({
  label,
  value,
  onChange,
  presets = DEFAULT_PALETTE_GROUPS,
  recent,
  allowCustom = true,
  onPreview,
  contrastAgainst,
  testID,
  disabled = false,
  hideLabel = false,
}: PaletteProps) {
  const { tokens } = useTheme();
  const { t } = useLocale();
  const skin = paletteSkin(tokens);
  const { colors } = tokens;

  const [open, setOpen] = useState(false);
  /** `null` means "mirror `value`"; a string means the user is mid-edit. */
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [hexError, setHexError] = useState<string | null>(null);
  const [callout, setCallout] = useState<CalloutTarget | null>(null);
  const [calloutSize, setCalloutSize] = useState<{ width: number; height: number } | null>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  const bodyRef = useRef<View>(null);
  /** The swatch under the finger — async measurements for any other are stale. */
  const pressedRef = useRef<HexColor | null>(null);

  const groups: readonly PaletteGroup[] = recent?.length
    ? [...presets, { label: t('palette.recent'), swatches: recent }]
    : presets;
  const selectedSwatch = groups
    .flatMap((group) => group.swatches)
    .find((swatch) => swatch.value === value);
  const contrast = contrastAgainst ? contrastRatio(value, contrastAgainst) : null;

  const openSheet = () => {
    setHexDraft(null);
    setHexError(null);
    setCallout(null);
    setOpen(true);
  };
  const close = () => {
    hideCallout();
    setOpen(false);
  };

  const commitSwatch = (next: HexColor) => {
    if (next !== value) onChange(next);
    close();
  };

  const commitHex = () => {
    if (hexDraft === null) return;
    const parsed = parseHexColor(hexDraft);
    if (!parsed) {
      setHexError(t('palette.hexInvalid'));
      return;
    }
    setHexDraft(null);
    setHexError(null);
    if (parsed !== value) onChange(parsed);
  };

  // L3: the sheet stays open, like the web popup while the OS picker is used.
  const openNativePicker = async () => {
    const picked = await pickNativeColor({ initial: value, title: label, onPreview });
    if (picked && picked !== value) onChange(picked);
  };

  const showCallout = (swatch: PaletteSwatch, element: View) => {
    const body = bodyRef.current;
    if (!body) return;
    pressedRef.current = swatch.value;
    element.measureInWindow((x, y, width, height) => {
      body.measureInWindow((bodyX, bodyY) => {
        // The finger may already be up (a quick tap commits and closes).
        if (pressedRef.current !== swatch.value) return;
        setCalloutSize(null); // re-measured for the new text
        setCallout({ swatch, anchor: { x: x - bodyX, y: y - bodyY, width, height } });
      });
    });
  };
  const hideCallout = () => {
    pressedRef.current = null;
    setCallout(null);
  };

  const placement =
    callout && calloutSize ? placeCallout(callout.anchor, calloutSize, bodyWidth) : null;

  return (
    <View style={{ gap: tokens.spacing.xs }}>
      {hideLabel ? null : (
        <AppText variant="caption" bold muted>
          {label}
        </AppText>
      )}

      <Pressable
        testID={testID}
        onPress={openSheet}
        disabled={disabled}
        hitSlop={touchSlop(tokens, tokens.controlHeight)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedSwatch?.name ?? value}`}
        accessibilityState={{ disabled, expanded: open }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          minHeight: tokens.controlHeight,
          paddingHorizontal: tokens.controlPaddingX,
          borderWidth: tokens.borderWidth,
          borderColor: colors.border,
          borderRadius: tokens.radius.control,
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          opacity: disabled ? 0.55 : 1,
          ...skin.trigger,
        })}
      >
        <Chip color={value} size={Math.round(tokens.type.body * 1.25)} />
        <AppText
          numberOfLines={1}
          style={{ flex: 1, ...(skin.triggerWeight ? { fontWeight: skin.triggerWeight } : null) }}
        >
          {selectedSwatch?.name ?? value}
        </AppText>
        <Ionicons name="chevron-down" size={tokens.type.body} color={colors.textMuted} />
      </Pressable>

      {/* The sheet's content keeps re-rendering from this component's live
          state (draft, error, callout) — the declarative door's case 2. It
          owns its scrolling (scrollable={false}) so the callout can float
          above the scroll region instead of being clipped by it. */}
      <BottomSheet
        open={open}
        onClose={close}
        title={label}
        testID={`${testID}.sheet`}
        scrollable={false}
        footer={
          allowCustom || (contrast !== null && contrast < MIN_CONTRAST) ? (
            <View style={{ width: '100%', gap: skin.sectionGap }}>
              {allowCustom ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: tokens.spacing.sm,
                    paddingTop: tokens.spacing.sm,
                    borderTopWidth: tokens.borderWidth,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <TextField
                      testID={`${testID}.hex`}
                      label={t('palette.hexLabel')}
                      value={hexDraft ?? value}
                      error={hexError}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onChangeText={(text) => {
                        setHexDraft(text);
                        setHexError(null);
                      }}
                      onBlur={commitHex}
                      onSubmitEditing={commitHex}
                    />
                  </View>
                  {nativeColorPickerAvailable ? (
                    <Pressable
                      testID={`${testID}.native`}
                      onPress={() => void openNativePicker()}
                      hitSlop={touchSlop(tokens, tokens.controlHeight)}
                      accessibilityRole="button"
                      accessibilityLabel={t('palette.customColor')}
                      style={({ pressed }) => ({
                        width: tokens.controlHeight,
                        height: tokens.controlHeight,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: tokens.borderWidth,
                        borderColor: colors.border,
                        borderRadius: tokens.radius.control,
                        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                        // Keep the field's error line from pushing the button down.
                        marginBottom: hexError ? tokens.type.caption * 1.4 + tokens.spacing.xs : 0,
                        ...skin.nativeButton,
                      })}
                    >
                      <Ionicons
                        name="color-palette-outline"
                        size={Math.round(tokens.controlHeight * 0.55)}
                        color={colors.text}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {contrast !== null && contrast < MIN_CONTRAST ? (
                <View
                  testID={`${testID}.contrast`}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: tokens.spacing.sm,
                    paddingHorizontal: tokens.spacing.sm,
                  }}
                >
                  <Ionicons
                    name="warning-outline"
                    size={tokens.type.caption}
                    color={colors.warning}
                  />
                  <AppText variant="caption" color={colors.warning} style={{ flex: 1 }}>
                    {t('palette.contrastWarning', {
                      // Truncated, not rounded: 4.46 must not read as "4.5:1 — below 4.5".
                      ratio: (Math.floor(contrast * 10) / 10).toFixed(1),
                      minimum: MIN_CONTRAST.toFixed(1),
                    })}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : undefined
        }
      >
        <View
          ref={bodyRef}
          onLayout={(event) => setBodyWidth(event.nativeEvent.layout.width)}
          style={{ flexShrink: 1 }}
        >
          <ScrollBox
            contentContainerStyle={{ gap: skin.sectionGap }}
            keyboardShouldPersistTaps="handled"
            // Scrolling cancels the press, which also hides the callout.
            onScrollBeginDrag={hideCallout}
          >
            {groups.map((group, groupIndex) => (
              <View key={group.label ?? groupIndex} style={{ gap: tokens.spacing.xs }}>
                {group.label ? (
                  <AppText variant="caption" bold muted>
                    {group.label}
                  </AppText>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: skin.gridGap }}>
                  {group.swatches.map((swatch) => (
                    <Swatch
                      key={swatch.value}
                      swatch={swatch}
                      selected={swatch.value === value}
                      skin={skin}
                      testID={`${testID}.swatch.${swatch.value.slice(1)}`}
                      onPressIn={showCallout}
                      onPressOut={hideCallout}
                      onPress={() => commitSwatch(swatch.value)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollBox>

          {/* One callout per sheet, outside the ScrollView so the grid edges
              (where it is needed most) can't clip it. Decorative: the swatch's
              own accessibility label already says "name (value)". */}
          {callout ? (
            <View
              // Remount per swatch so onLayout always reports the new size.
              key={callout.swatch.value}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                if (!calloutSize) setCalloutSize({ width, height });
              }}
              style={{
                position: 'absolute',
                left: placement?.left ?? 0,
                top: placement?.top ?? 0,
                opacity: placement ? 1 : 0, // first frame only measures
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: tokens.spacing.sm,
                paddingVertical: tokens.spacing.xs,
                paddingHorizontal: tokens.spacing.sm,
                ...skin.callout,
              }}
            >
              <AppText variant="caption" color={skin.calloutText.color} style={skin.calloutText}>
                {callout.swatch.name}
              </AppText>
              <AppText
                variant="caption"
                color={skin.calloutText.color}
                style={{ ...skin.calloutText, opacity: 0.75 }}
              >
                {callout.swatch.value}
              </AppText>
            </View>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

/** Color chip over the alpha checker (trigger + swatches). */
function Chip({ color, size }: { color: HexColor; size: number }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: tokens.radius.control / 2,
        borderWidth: tokens.borderWidth,
        borderColor: tokens.colors.border,
        backgroundColor: tokens.colors.surface,
        overflow: 'hidden',
      }}
    >
      {isTranslucent(color) ? <Checker size={size} color={tokens.colors.textMuted} /> : null}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

interface SwatchProps {
  swatch: PaletteSwatch;
  selected: boolean;
  skin: PaletteSkin;
  testID: string;
  onPressIn: (swatch: PaletteSwatch, element: View) => void;
  onPressOut: () => void;
  onPress: () => void;
}

function Swatch({ swatch, selected, skin, testID, onPressIn, onPressOut, onPress }: SwatchProps) {
  const { tokens, reduceMotion } = useTheme();
  const ref = useRef<View>(null);
  const pop = useMotionProgress();
  // Scale-up is size-proportional growth: off inside the grid's ScrollBox.
  const insideScrollBox = useInsideScrollBox();
  const pops = skin.pressPop && !reduceMotion && !insideScrollBox;
  const { swatchSize: size } = skin;

  return (
    // Kids: the swatch pops out of the grid while pressed (web: hover/focus).
    <Animated.View
      style={
        pops
          ? {
              transform: [
                { scale: pop.progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) },
                {
                  rotate: pop.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '-2.5deg'],
                  }),
                },
              ],
            }
          : undefined
      }
    >
      <Pressable
        ref={ref}
        testID={testID}
        hitSlop={skin.swatchHitSlop}
        accessibilityRole="button"
        accessibilityLabel={`${swatch.name} (${swatch.value})`}
        accessibilityState={{ selected }}
        onPressIn={() => {
          if (pops) pop.animateTo(1);
          if (ref.current) onPressIn(swatch, ref.current);
        }}
        onPressOut={() => {
          if (pops) pop.animateTo(0);
          onPressOut();
        }}
        onPress={onPress}
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: skin.swatchRadius,
          borderWidth: tokens.borderWidth,
          borderColor: tokens.colors.border,
          backgroundColor: tokens.colors.surface,
          ...(selected && skin.selectedRing ? { boxShadow: skin.selectedRing } : null),
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: skin.swatchRadius,
            overflow: 'hidden',
          }}
        >
          {isTranslucent(swatch.value) ? (
            <Checker size={size} color={tokens.colors.textMuted} />
          ) : null}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: swatch.value,
            }}
          />
        </View>
        {selected && skin.selectedInset ? (
          // Office: 2px outline drawn inward over the border (CSS outline-offset -2px).
          <View
            style={{
              position: 'absolute',
              top: -tokens.borderWidth,
              left: -tokens.borderWidth,
              right: -tokens.borderWidth,
              bottom: -tokens.borderWidth,
              ...skin.selectedInset,
            }}
          />
        ) : null}
        {selected ? (
          <Ionicons name="checkmark" size={Math.round(size * 0.55)} color={inkFor(swatch.value)} />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
