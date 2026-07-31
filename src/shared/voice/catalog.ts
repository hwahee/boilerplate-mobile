/**
 * ═══ THE VOICE INTENT CATALOG — one source of truth for Siri, Bixby and
 *     Google Assistant ═══
 *
 * The three assistants are integrated in three completely different places:
 *
 *   Siri              Swift `AppIntent` structs compiled into the iOS app
 *   Google Assistant  `res/xml/shortcuts.xml` inside the Android app
 *   Bixby             a Capsule project running on Samsung's cloud (capsule/)
 *
 * Those entry points CANNOT be unified — the platform APIs have nothing in
 * common. What can be unified is everything upstream of them: which actions
 * exist, what parameters they take, what the user says, and what the app then
 * does. That is this file. The native artifacts are GENERATED from it
 * (`bun run voice:generate`), so an intent is added once, here.
 *
 * ── Execution modes ────────────────────────────────────────────────────────
 *
 *   'deeplink'  The assistant opens the app with `…://voice/<id>?<params>`
 *               and the RN handler registry (apps/mobile/src/voice) runs the
 *               feature. The DEFAULT: it reuses the app's own logic and state,
 *               and most voice-sized actions (play/pause, next, run a search)
 *               are client state that no server call can express.
 *
 *   'api'       The native stub calls `POST /api/voice/<id>` directly and
 *               speaks the answer back. The app is never opened. Use this
 *               when the action is a pure server round-trip AND the user needs
 *               a SPOKEN answer — Bixby in particular can only return speech
 *               this way, because a Capsule never learns what a deep link did.
 *
 * ── Driving-first constraints baked into this contract ─────────────────────
 *
 *   - Every phrase must contain {@link APP_NAME_TOKEN}. Siri hard-requires the
 *     app name in an `AppShortcut` phrase; keeping the token in all three
 *     surfaces means one phrase list works everywhere.
 *   - At most ONE required text parameter per intent. Multi-slot dialogue is
 *     unusable at the wheel — see `voiceCatalogIssues`.
 *   - `drivingSafe: false` marks intents that still need eyes or hands after
 *     the assistant hands over. They stay in the catalog (they are useful when
 *     parked) but docs and generated output flag them.
 *
 * ── Not in scope here ──────────────────────────────────────────────────────
 *
 * Media transport control (play/pause/next/previous) of a real player should
 * NOT be modelled as intents: `MPRemoteCommandCenter` (iOS) and `MediaSession`
 * (Android) give you Siri/Assistant/Bixby control, lock-screen controls and
 * CarPlay/Android Auto for free. See docs/voice-assistant.md.
 */
import type { Locale } from '../i18n';
import { s, toValidator, type Validator } from '../validation';

/**
 * Placeholder for the user-visible app name inside a phrase. Each generator
 * substitutes it: Siri with `\(.applicationName)`, Bixby/Assistant with the
 * literal name (they have no equivalent token).
 */
export const APP_NAME_TOKEN = '{appName}';

/** Path segment that marks a deep link as a voice command. */
export const VOICE_LINK_SEGMENT = 'voice';

/**
 * The name users actually SAY. Siri substitutes the installed app's name for
 * {@link APP_NAME_TOKEN} on its own; Bixby and Google Assistant have no such
 * token, so the generators splice this in literally — which is also correct
 * for Bixby, where a private capsule must be addressed by name anyway
 * ("Bixby, ask Boiler to …").
 *
 * Keep it in sync with `name` in apps/mobile/app.config.ts, and pick something
 * a speech recognizer gets right the first time: short, no homophones, no
 * initialisms. This single string decides whether voice works in a noisy car.
 */
export const VOICE_INVOCATION_NAME = 'Boiler';

/** @public part of the catalog contract — iterate the modes without hardcoding them */
export const VOICE_EXECUTIONS = ['deeplink', 'api'] as const;
export type VoiceExecution = (typeof VOICE_EXECUTIONS)[number];

/**
 * Parameter types, deliberately tiny. Every assistant models slots
 * differently; only these two map cleanly onto all three, and anything richer
 * means a dialogue the driver cannot follow.
 */
/** @public part of the catalog contract */
export const VOICE_PARAM_KINDS = ['text', 'integer'] as const;
/** @public part of the catalog contract */
export type VoiceParamKind = (typeof VOICE_PARAM_KINDS)[number];

/**
 * Permission scope carried by the voice token. Scopes are per-capability, not
 * per-intent, so revoking "voice may write todos" is one decision rather than
 * one per phrase. Only `api` intents use them — a deep link runs inside the
 * app, under the user's normal session.
 */
export const VOICE_SCOPES = ['todos:read', 'todos:write'] as const;
export type VoiceScope = (typeof VOICE_SCOPES)[number];

export interface VoiceParam {
  /** Slot name; also the deep-link query key and the JSON body key. */
  readonly name: string;
  readonly kind: VoiceParamKind;
  readonly required: boolean;
  /** Upper bound for `text` params — assistants can hand over long dictations. */
  readonly maxLength?: number;
  /** Spoken when the assistant has to ask for the value ("What should I search for?"). */
  readonly prompt: Readonly<Record<Locale, string>>;
}

interface VoiceIntentBase {
  /**
   * Stable id, `<feature>.<action>`. Appears verbatim in the deep-link path,
   * the API path and every generated native artifact — renaming one is a
   * breaking change for already-shipped binaries and for the published
   * Capsule, so treat it like a wire format.
   */
  readonly id: string;
  /** Short label shown in the Shortcuts app / Bixby capsule listing. */
  readonly title: Readonly<Record<Locale, string>>;
  /** Example utterances. Each MUST contain {@link APP_NAME_TOKEN}. */
  readonly phrases: Readonly<Record<Locale, readonly string[]>>;
  readonly params: readonly VoiceParam[];
  /**
   * Can the user complete this without looking at or touching the phone?
   * `false` = the assistant only gets them to the right place.
   */
  readonly drivingSafe: boolean;
}

/**
 * Opens the app via `…://voice/<id>`; the RN handler registry executes it.
 * @public one arm of the VoiceIntent union
 */
export interface DeepLinkVoiceIntent extends VoiceIntentBase {
  readonly execution: 'deeplink';
}

/**
 * Native stub → `POST /api/voice/<id>` → spoken answer. App stays closed.
 * @public one arm of the VoiceIntent union
 */
export interface ApiVoiceIntent extends VoiceIntentBase {
  readonly execution: 'api';
  readonly scope: VoiceScope;
}

export type VoiceIntent = DeepLinkVoiceIntent | ApiVoiceIntent;

/**
 * The catalog.
 *
 * These four exercise both execution modes and both parameter cases; they are
 * the demo surface of the boilerplate's todo domain. Replace them with your
 * app's handful of core actions — the whole point is that this list stays
 * SHORT. An assistant surface is not a menu; it is the two or three things a
 * driver should be able to do without looking.
 */
export const VOICE_INTENTS = [
  {
    id: 'todo.create',
    execution: 'api',
    scope: 'todos:write',
    drivingSafe: true,
    title: { en: 'Add a todo', ko: '할 일 추가' },
    phrases: {
      en: [`Add a todo in ${APP_NAME_TOKEN}`, `Remember something in ${APP_NAME_TOKEN}`],
      ko: [`${APP_NAME_TOKEN}에 할 일 추가`, `${APP_NAME_TOKEN}에 메모해줘`],
    },
    params: [
      {
        name: 'title',
        kind: 'text',
        required: true,
        maxLength: 200,
        prompt: { en: 'What should I add?', ko: '무엇을 추가할까요?' },
      },
    ],
  },
  {
    id: 'todo.summary',
    execution: 'api',
    scope: 'todos:read',
    drivingSafe: true,
    title: { en: 'How many todos are open', ko: '남은 할 일 개수' },
    phrases: {
      en: [`What's left in ${APP_NAME_TOKEN}`, `How many todos in ${APP_NAME_TOKEN}`],
      ko: [`${APP_NAME_TOKEN}에 남은 할 일`, `${APP_NAME_TOKEN} 할 일 몇 개야`],
    },
    params: [],
  },
  {
    id: 'todos.search',
    execution: 'deeplink',
    // Opens the list filtered by the spoken term — the driver still has to
    // read the result, so this is a "get me there", not a hands-free action.
    drivingSafe: false,
    title: { en: 'Search todos', ko: '할 일 검색' },
    phrases: {
      en: [`Search ${APP_NAME_TOKEN}`, `Find something in ${APP_NAME_TOKEN}`],
      ko: [`${APP_NAME_TOKEN}에서 검색`, `${APP_NAME_TOKEN}에서 찾아줘`],
    },
    params: [
      {
        name: 'query',
        kind: 'text',
        required: true,
        maxLength: 200,
        prompt: { en: 'What should I search for?', ko: '무엇을 검색할까요?' },
      },
    ],
  },
  {
    id: 'todos.open',
    execution: 'deeplink',
    drivingSafe: false,
    title: { en: 'Open todos', ko: '할 일 열기' },
    phrases: {
      en: [`Open ${APP_NAME_TOKEN}`, `Show my todos in ${APP_NAME_TOKEN}`],
      ko: [`${APP_NAME_TOKEN} 열어줘`, `${APP_NAME_TOKEN} 할 일 보여줘`],
    },
    params: [],
  },
] as const satisfies readonly VoiceIntent[];

/**
 * A catalog ENTRY — narrower than {@link VoiceIntent}, because it keeps the
 * literal ids. That is what lets the server's handler map be exhaustive over
 * `api` intents, so the contract cannot drift ahead of the implementation.
 */
export type CatalogVoiceIntent = (typeof VOICE_INTENTS)[number];

export type VoiceIntentId = CatalogVoiceIntent['id'];

/** Ids of the server-executed intents — the keys of the handler map. */
export type ApiVoiceIntentId = Extract<CatalogVoiceIntent, { execution: 'api' }>['id'];

/** Ids the app executes itself — the keys of the RN handler registry. */
export type DeepLinkVoiceIntentId = Extract<CatalogVoiceIntent, { execution: 'deeplink' }>['id'];

const BY_ID = new Map<string, CatalogVoiceIntent>(
  VOICE_INTENTS.map((intent) => [intent.id, intent]),
);

export function isVoiceIntentId(value: unknown): value is VoiceIntentId {
  return typeof value === 'string' && BY_ID.has(value);
}

/** Looks an intent up by id; `undefined` for anything not in the catalog. */
export function findVoiceIntent(id: string): CatalogVoiceIntent | undefined {
  return BY_ID.get(id);
}

/** The intents a given execution mode owns — what each generator iterates. */
export function voiceIntentsBy(execution: VoiceExecution): readonly CatalogVoiceIntent[] {
  return VOICE_INTENTS.filter((intent) => intent.execution === execution);
}

/**
 * Builds the validator for one intent's parameters, so the server route, the
 * RN handler and the tests all reject the same inputs. Assistants hand over
 * everything as strings, hence `integer` accepts a numeric string too.
 */
export function voiceParamsValidator(intent: VoiceIntent): Validator<Record<string, unknown>> {
  const shape: Record<string, unknown> = {};
  for (const param of intent.params) {
    const base =
      param.kind === 'integer'
        ? // Assistants hand every slot over as a string, so coerce before checking.
          s.coerce.number().check(s.int())
        : s.string().check(
            s.minLength(1),
            s.maxLength(param.maxLength ?? 200),
            s.refine((value: string) => value.trim().length > 0, {
              message: `${param.name} must not be blank`,
            }),
          );
    shape[param.name] = param.required ? base : s.optional(base);
  }
  return toValidator(s.strictObject(shape));
}

/**
 * Self-check over the catalog, run by the unit tests AND by the generator so
 * a broken contract never reaches a Swift/XML/Capsule artifact. Returns the
 * problems found; an empty array means the catalog is well-formed.
 *
 * These are not style rules — every one of them corresponds to a way the
 * integration breaks in the field (a phrase Siri refuses to register, a slot
 * the driver cannot fill, an id that cannot survive a URL).
 */
export function voiceCatalogIssues(locales: readonly Locale[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();

  for (const intent of VOICE_INTENTS) {
    if (seen.has(intent.id)) issues.push(`duplicate intent id: ${intent.id}`);
    seen.add(intent.id);

    // The id travels through a URL path and a Swift identifier.
    if (!/^[a-z][a-z0-9]*\.[a-z][a-zA-Z0-9]*$/.test(intent.id)) {
      issues.push(`${intent.id}: id must look like "<feature>.<action>" and be URL-safe`);
    }

    const requiredText = intent.params.filter((p) => p.required && p.kind === 'text');
    if (requiredText.length > 1) {
      issues.push(
        `${intent.id}: ${String(requiredText.length)} required text params — a driver cannot fill more than one`,
      );
    }

    for (const param of intent.params) {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(param.name)) {
        issues.push(`${intent.id}.${param.name}: param name must be a lowerCamelCase identifier`);
      }
      for (const locale of locales) {
        if (!param.prompt[locale]?.trim()) {
          issues.push(`${intent.id}.${param.name}: missing "${locale}" prompt`);
        }
      }
    }

    for (const locale of locales) {
      if (!intent.title[locale]?.trim()) issues.push(`${intent.id}: missing "${locale}" title`);

      // Widened on purpose: the literal tuple types from `as const` would make
      // the emptiness check below a compile-time constant.
      const phrases: readonly string[] = intent.phrases[locale] ?? [];
      if (phrases.length === 0) issues.push(`${intent.id}: no "${locale}" phrases`);
      for (const phrase of phrases) {
        // Siri refuses to register an AppShortcut phrase without the app name.
        if (!phrase.includes(APP_NAME_TOKEN)) {
          issues.push(`${intent.id}: "${locale}" phrase is missing ${APP_NAME_TOKEN}: "${phrase}"`);
        }
      }
    }
  }
  return issues;
}
