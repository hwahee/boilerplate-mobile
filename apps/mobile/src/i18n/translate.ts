/**
 * Translation over the APP's message catalogs (./messages).
 *
 * Locale identity (which locales exist, how a device/Accept-Language string
 * maps onto one) is repo-wide and comes from `@shared/i18n`; only the
 * catalogs are app-local, so an API error localized by the server and a
 * screen string rendered by the app always agree on the locale.
 */
import { DEFAULT_LOCALE, type Locale, type MessageParams } from '@shared/i18n';

import { en, type MessageKey } from './messages/en';
import { ko } from './messages/ko';

export type { MessageKey };

const catalogs: Record<Locale, Record<MessageKey, string>> = { en, ko };

/**
 * Translates `key` for `locale`, falling back to the default locale's text
 * when a key is (unexpectedly) missing at runtime.
 */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const template = catalogs[locale][key] ?? catalogs[DEFAULT_LOCALE][key];
  if (!params) return template;
  return template.replaceAll(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
