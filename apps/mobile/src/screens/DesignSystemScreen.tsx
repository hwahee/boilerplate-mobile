/**
 * Design-system gallery — every token and component on ONE in-app screen.
 * Registered in DEV builds only (see RootNavigator). Flip theme/design/
 * language in Settings and come back to see everything restyle.
 */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Accordion } from '../components/Accordion';
import { AnchoredScrollView } from '../components/AnchoredScrollView';
import { AppText } from '../components/AppText';
import { Badge } from '../components/Badge';
import { Banner } from '../components/Banner';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { IconButton } from '../components/IconButton';
import { Screen } from '../components/Screen';
import { Spinner } from '../components/Spinner';
import { TextField } from '../components/TextField';
import { useLocale } from '../i18n/LocaleProvider';
import { useTheme } from '../theme/ThemeProvider';
import { TESTID } from '../testing/testids';

function Section({ name, title, children }: { name: string; title: string; children: ReactNode }) {
  const { tokens } = useTheme();
  return (
    <Card testID={TESTID.designSystem.section(name)} style={{ gap: tokens.spacing.md }}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </Card>
  );
}

export function DesignSystemScreen() {
  const { tokens } = useTheme();
  const { t } = useLocale();
  const [fieldValue, setFieldValue] = useState('');

  // Cast: Object.entries needs an index signature to keep the value typed.
  const swatches = Object.entries(tokens.colors as unknown as Record<string, string>).filter(
    ([, value]) => value.startsWith('#'),
  );

  return (
    <Screen testID={TESTID.designSystem.screen} padded={false}>
      <AnchoredScrollView
        contentContainerStyle={{ padding: tokens.spacing.md, gap: tokens.spacing.md }}
      >
        <AppText muted>{t('designSystem.description')}</AppText>

        <Section name="colors" title={t('designSystem.colors')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm }}>
            {swatches.map(([name, value]) => (
              <View key={name} style={{ alignItems: 'center', gap: tokens.spacing.xs, width: 84 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: tokens.radius.md,
                    backgroundColor: value,
                    borderWidth: tokens.borderWidth,
                    borderColor: tokens.colors.border,
                  }}
                />
                <AppText variant="caption" muted numberOfLines={1}>
                  {name}
                </AppText>
              </View>
            ))}
          </View>
        </Section>

        <Section name="typography" title={t('designSystem.typography')}>
          <AppText variant="title">Title {tokens.type.title}pt</AppText>
          <AppText variant="heading">Heading {tokens.type.heading}pt</AppText>
          <AppText>Body {tokens.type.body}pt — 본문 텍스트</AppText>
          <AppText variant="caption" muted>
            Caption {tokens.type.caption}pt — 캡션
          </AppText>
        </Section>

        <Section name="buttons" title={t('designSystem.buttons')}>
          <Button testID="ds.button.primary" label="Primary" onPress={() => undefined} />
          <Button
            testID="ds.button.secondary"
            label="Secondary"
            variant="secondary"
            onPress={() => undefined}
          />
          <Button
            testID="ds.button.danger"
            label="Danger"
            variant="danger"
            onPress={() => undefined}
          />
          <Button
            testID="ds.button.ghost"
            label="Ghost"
            variant="ghost"
            onPress={() => undefined}
          />
          <Button testID="ds.button.loading" label="Loading" loading onPress={() => undefined} />
          <Button testID="ds.button.disabled" label="Disabled" disabled onPress={() => undefined} />
          <IconButton
            testID="ds.icon-button"
            icon="heart-outline"
            accessibilityLabel="Example icon button"
            onPress={() => undefined}
          />
        </Section>

        <Section name="form" title={t('designSystem.formFields')}>
          <TextField
            testID="ds.textfield"
            label="Label"
            placeholder="Placeholder"
            value={fieldValue}
            onChangeText={setFieldValue}
          />
          <TextField
            testID="ds.textfield-error"
            label="With error"
            placeholder="Placeholder"
            value=""
            onChangeText={() => undefined}
            error="Something is wrong here"
          />
        </Section>

        <Section name="feedback" title={t('designSystem.feedback')}>
          <Banner text="Info banner" />
          <Banner text="Warning banner" tone="warning" />
          <Banner text="Danger banner" tone="danger" />
          <Spinner accessibilityLabel={t('common.loading')} size="small" />
          <EmptyState message={t('todos.empty')} />
          <ErrorState
            message={t('todos.loadFailed')}
            retryLabel={t('common.retry')}
            retryTestID="ds.error-retry"
            onRetry={() => undefined}
          />
        </Section>

        <Section name="data" title={t('designSystem.dataDisplay')}>
          <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
            <Badge label="Neutral" />
            <Badge label="Success" tone="success" />
            <Badge label="Warning" tone="warning" />
            <Badge label="Danger" tone="danger" />
          </View>
        </Section>

        <Section name="disclosure" title={t('designSystem.disclosure')}>
          <Accordion
            mode="single"
            defaultOpenIds={['motion']}
            testID="ds.accordion"
            items={[
              {
                id: 'motion',
                title: 'Escape hatch #0 — the shift is animated',
                content: (
                  <AppText>
                    Expanding inline content inevitably shifts everything below it. Instead of an
                    instant jump, panels animate open over motion.durationExpand so the eye can
                    track where content moved. Skins stay in charge: office zeroes it (instant, like
                    the era), kids turns it into a springy overshoot, and the OS reduce-motion
                    setting disables it entirely.
                  </AppText>
                ),
              },
              {
                id: 'anchor',
                title: 'Escape hatch #1 — the pressed trigger stays put',
                content: (
                  <View style={{ gap: tokens.spacing.sm }}>
                    <AppText>
                      In single mode, opening this item collapses the (possibly taller) item above
                      it — without correction, this header would slide up and away from your finger.
                      The component records where the header was and scrolls to hold it there.
                    </AppText>
                    <AppText>
                      Try it: open the first item, scroll until both headers sit mid-screen, then
                      open this one. The header holds still while the panel above folds away.
                    </AppText>
                  </View>
                ),
              },
              {
                id: 'reveal',
                title: 'Escape hatch #2 — opened content is revealed',
                content: (
                  <AppText>
                    If an opened panel ends up cut off by the bottom of the screen, the list scrolls
                    just enough to bring it into view — never so far that this header leaves the
                    screen. A shift the user asked for is guidance; a shift they didn&apos;t is a
                    layout jump.
                  </AppText>
                ),
              },
            ]}
          />
        </Section>
      </AnchoredScrollView>
    </Screen>
  );
}
