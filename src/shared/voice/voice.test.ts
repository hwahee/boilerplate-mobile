import { describe, expect, test } from 'bun:test';

import { SUPPORTED_LOCALES } from '../i18n';
import {
  APP_NAME_TOKEN,
  VOICE_INTENTS,
  findVoiceIntent,
  isVoiceIntentId,
  voiceCatalogIssues,
  voiceIntentsBy,
  voiceParamsValidator,
} from './catalog';
import { parseVoiceLink, voiceLinkPath, voiceLinkTemplate } from './link';

describe('voice catalog', () => {
  test('is well-formed for every supported locale', () => {
    expect(voiceCatalogIssues(SUPPORTED_LOCALES)).toEqual([]);
  });

  test('every phrase carries the app-name token Siri requires', () => {
    for (const intent of VOICE_INTENTS) {
      for (const locale of SUPPORTED_LOCALES) {
        for (const phrase of intent.phrases[locale]) {
          expect(phrase).toContain(APP_NAME_TOKEN);
        }
      }
    }
  });

  test('stays small enough to be usable at the wheel', () => {
    // Not arbitrary: an assistant surface the driver has to remember is a
    // failed assistant surface. Raising this bound is a product decision.
    expect(VOICE_INTENTS.length).toBeLessThanOrEqual(8);
  });

  test('lookup only accepts catalog ids', () => {
    expect(isVoiceIntentId('todo.create')).toBe(true);
    expect(isVoiceIntentId('todo.nope')).toBe(false);
    expect(isVoiceIntentId(42)).toBe(false);
    expect(findVoiceIntent('todo.nope')).toBeUndefined();
  });

  test('partitions cleanly by execution mode', () => {
    const deeplink = voiceIntentsBy('deeplink');
    const api = voiceIntentsBy('api');
    expect(deeplink.length + api.length).toBe(VOICE_INTENTS.length);
    expect(api.every((intent) => intent.execution === 'api')).toBe(true);
  });

  test('catalog issues are reported rather than thrown', () => {
    // Sanity-check the checker itself against a locale nothing defines.
    const issues = voiceCatalogIssues(['xx' as never]);
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe('voiceParamsValidator', () => {
  const create = findVoiceIntent('todo.create');
  if (!create) throw new Error('todo.create missing from the catalog');

  test('accepts a well-formed slot value', () => {
    expect(voiceParamsValidator(create).parse({ title: 'Buy milk' })).toEqual({
      title: 'Buy milk',
    });
  });

  test('rejects a missing required slot', () => {
    expect(voiceParamsValidator(create).safeParse({}).ok).toBe(false);
  });

  test('rejects a blank dictation', () => {
    expect(voiceParamsValidator(create).safeParse({ title: '   ' }).ok).toBe(false);
  });

  test('rejects unknown slots', () => {
    expect(voiceParamsValidator(create).safeParse({ title: 'ok', extra: 1 }).ok).toBe(false);
  });

  test('a param-less intent accepts only an empty object', () => {
    const summary = findVoiceIntent('todo.summary');
    if (!summary) throw new Error('todo.summary missing from the catalog');
    expect(voiceParamsValidator(summary).parse({})).toEqual({});
    expect(voiceParamsValidator(summary).safeParse({ title: 'x' }).ok).toBe(false);
  });
});

describe('voice deep links', () => {
  test('builds a path with encoded params', () => {
    expect(voiceLinkPath('todos.search', { query: 'buy milk' })).toBe(
      'voice/todos.search?query=buy%20milk',
    );
  });

  test('omits the query string when there is nothing to send', () => {
    expect(voiceLinkPath('todos.open')).toBe('voice/todos.open');
  });

  test('emits a placeholder template for the native generators', () => {
    const search = findVoiceIntent('todos.search');
    if (!search) throw new Error('todos.search missing from the catalog');
    expect(voiceLinkTemplate(search)).toBe('voice/todos.search?query={query}');
  });

  test('parses the custom-scheme form, where "voice" is the authority', () => {
    expect(parseVoiceLink('mobileboilerplate://voice/todos.search?query=milk')).toEqual({
      intentId: 'todos.search',
      params: { query: 'milk' },
    });
  });

  test('parses the https form, where "voice" is a path segment', () => {
    expect(parseVoiceLink('https://app.example.com/voice/todos.open')).toEqual({
      intentId: 'todos.open',
      params: {},
    });
  });

  test('round-trips a value needing percent-encoding', () => {
    const path = voiceLinkPath('todos.search', { query: '우유 & 빵' });
    expect(parseVoiceLink(`mobileboilerplate-dev://${path}`)?.params.query).toBe('우유 & 빵');
  });

  test('decodes "+" as a space', () => {
    expect(parseVoiceLink('scheme://voice/todos.search?query=buy+milk')?.params.query).toBe(
      'buy milk',
    );
  });

  test('ignores the fragment', () => {
    expect(parseVoiceLink('scheme://voice/todos.open?a=1#frag')).toEqual({
      intentId: 'todos.open',
      params: { a: '1' },
    });
  });

  test('returns null for links that are not voice commands', () => {
    expect(parseVoiceLink('mobileboilerplate://todos')).toBeNull();
    expect(parseVoiceLink('https://app.example.com/settings')).toBeNull();
    expect(parseVoiceLink('')).toBeNull();
  });

  test('returns null when the marker has no intent after it', () => {
    expect(parseVoiceLink('mobileboilerplate://voice')).toBeNull();
    expect(parseVoiceLink('https://app.example.com/voice/')).toBeNull();
  });

  test('survives a malformed percent escape instead of throwing', () => {
    expect(parseVoiceLink('scheme://voice/todos.search?query=%E0%A4%A')?.params.query).toBe(
      '%E0%A4%A',
    );
  });
});
