/**
 * The voice deep-link format — how a native assistant stub hands a command
 * over to the running app.
 *
 *   mobileboilerplate://voice/todos.search?query=milk       (custom scheme)
 *   https://app.example.com/voice/todos.search?query=milk   (Universal/App Link)
 *
 * Both forms are accepted so the same intent works whether the assistant
 * launches the app by scheme (Siri, Bixby) or by verified web link (Google
 * Assistant App Actions, which prefers https URLs).
 *
 * `voice/` is deliberately NOT registered in the React Navigation linking
 * config (apps/mobile/src/navigation/linking.ts): these URLs are COMMANDS,
 * not screen addresses. React Navigation ignores paths it cannot match, and
 * apps/mobile/src/voice picks them up instead.
 *
 * Parsing is hand-rolled rather than `new URL()` on purpose — this module is
 * consumed by Hermes, where the URL polyfill is partial and mishandles custom
 * schemes. It stays dependency-free so Bun, Metro and the generator script can
 * all use the exact same implementation.
 */
import { VOICE_LINK_SEGMENT, type VoiceIntent } from './catalog';

export interface ParsedVoiceLink {
  /** Not validated against the catalog — the caller decides what is known. */
  readonly intentId: string;
  /** Raw string values, exactly as the assistant supplied them. */
  readonly params: Readonly<Record<string, string>>;
}

/** Percent-encodes a value for use in a query string (`+` means space on decode). */
function encodeComponent(value: string): string {
  return encodeURIComponent(value);
}

function decodeComponent(value: string): string {
  // Assistants and OS URL builders both produce `+` for spaces in practice.
  try {
    return decodeURIComponent(value.replaceAll('+', ' '));
  } catch {
    // A malformed escape sequence must not throw inside a link handler.
    return value;
  }
}

/**
 * The path (no scheme, no leading slash) a native stub should open for
 * `intent`. Used by the generators to emit Swift/XML/Capsule URL builders.
 */
export function voiceLinkPath(
  intentId: string,
  params: Readonly<Record<string, string>> = {},
): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${encodeComponent(key)}=${encodeComponent(value)}`)
    .join('&');
  const path = `${VOICE_LINK_SEGMENT}/${intentId}`;
  return query ? `${path}?${query}` : path;
}

/**
 * The same path with `{param}` placeholders left in — what a generated Swift
 * or Capsule template interpolates its slot values into.
 */
export function voiceLinkTemplate(intent: VoiceIntent): string {
  const query = intent.params.map((p) => `${p.name}={${p.name}}`).join('&');
  const path = `${VOICE_LINK_SEGMENT}/${intent.id}`;
  return query ? `${path}?${query}` : path;
}

/**
 * Extracts the intent from an inbound URL, or `null` when it is not a voice
 * link (an ordinary deep link, a notification tap, …). Never throws: this runs
 * on every URL the OS delivers to the app.
 */
export function parseVoiceLink(url: string): ParsedVoiceLink | null {
  if (typeof url !== 'string' || url.length === 0) return null;

  // Drop the scheme; what remains is `[authority]/path[?query][#fragment]`.
  // For `scheme://voice/x` the authority IS `voice`, for an https link it is
  // the host and `voice` is the first path segment — scanning for the segment
  // handles both without special-casing either.
  const schemeSplit = url.indexOf('://');
  const rest = schemeSplit === -1 ? url : url.slice(schemeSplit + 3);

  const withoutFragment = rest.split('#')[0] ?? '';
  const [pathPart = '', queryPart = ''] = splitOnce(withoutFragment, '?');

  const segments = pathPart.split('/').filter((segment) => segment.length > 0);
  const marker = segments.indexOf(VOICE_LINK_SEGMENT);
  if (marker === -1) return null;

  const intentId = segments[marker + 1];
  if (intentId === undefined || intentId.length === 0) return null;

  const params: Record<string, string> = {};
  for (const pair of queryPart.split('&')) {
    if (pair.length === 0) continue;
    const [rawKey = '', rawValue = ''] = splitOnce(pair, '=');
    if (rawKey.length === 0) continue;
    params[decodeComponent(rawKey)] = decodeComponent(rawValue);
  }

  return { intentId: decodeComponent(intentId), params };
}

function splitOnce(value: string, separator: string): [string, string] {
  const index = value.indexOf(separator);
  return index === -1
    ? [value, '']
    : [value.slice(0, index), value.slice(index + separator.length)];
}
