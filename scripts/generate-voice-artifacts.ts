/**
 * Generates the native assistant artifacts from src/shared/voice/catalog.ts.
 *
 *   bun run voice:generate   write them
 *   bun run voice:check      fail if what is on disk differs (part of `check`)
 *
 * Why generate rather than hand-write: the three assistants need the SAME
 * facts (which actions exist, their slots, their phrases) expressed in three
 * unrelated syntaxes, in files that live in three different build systems —
 * one of which (the Bixby Capsule) is not even built from this repository.
 * Hand-maintained, they drift silently, and the failure mode is a phrase that
 * works on one phone and not the other. Here the catalog is the only thing
 * anyone edits.
 *
 * Outputs:
 *   apps/mobile/native/ios/VoiceIntents.generated.swift   App Intents + shortcuts
 *   apps/mobile/native/ios/AppShortcuts.<locale>.strings  localized phrases
 *   apps/mobile/native/android/voice_shortcuts.generated.xml   App Actions
 *   capsule/boilerplate/resources/<locale>/training/*.training.bxb   Bixby
 *
 * The Android file keeps a `__VOICE_LINK_ORIGIN__` placeholder: the verified
 * App Link origin lives in app.config.ts (it is per-environment), so the
 * config plugin substitutes it at prebuild. Everything else here is a pure
 * function of the catalog, which is what makes `voice:check` meaningful.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '@shared/i18n';
import {
  APP_NAME_TOKEN,
  VOICE_INTENTS,
  VOICE_INVOCATION_NAME,
  voiceCatalogIssues,
  voiceIntentsBy,
  type CatalogVoiceIntent,
  type VoiceParam,
} from '@shared/voice/catalog';
import { voiceLinkTemplate } from '@shared/voice/link';

const ROOT = join(import.meta.dir, '..');
const BANNER =
  'GENERATED FILE — edit src/shared/voice/catalog.ts and run `bun run voice:generate`.';

/** `todo.create` → `TodoCreate` */
function pascalCase(intentId: string): string {
  return intentId
    .split(/[.\-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** `todos.search` → `TODOS_SEARCH` (Android custom BII naming). */
function screamingCase(intentId: string): string {
  return intentId
    .replace(/[.-]/g, '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase();
}

function swiftString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function xmlAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function swiftType(param: VoiceParam): string {
  const base = param.kind === 'integer' ? 'Int' : 'String';
  return param.required ? base : `${base}?`;
}

// ── iOS ──────────────────────────────────────────────────────────────────────

function swiftIntent(intent: CatalogVoiceIntent): string {
  const name = `${pascalCase(intent.id)}Intent`;
  const title = intent.title[DEFAULT_LOCALE];

  const parameters = intent.params
    .map(
      (param) =>
        `    @Parameter(title: "${swiftString(param.name)}", requestValueDialog: "${swiftString(
          param.prompt[DEFAULT_LOCALE],
        )}")\n    var ${param.name}: ${swiftType(param)}`,
    )
    .join('\n\n');

  // Optional slots are dropped rather than sent empty — the server's validator
  // rejects blanks, and "not said" is not the same as "said nothing".
  const paramDict = intent.params.length
    ? `var params: [String: String] = [:]\n${intent.params
        .map((param) =>
          param.required
            ? `        params["${param.name}"] = String(${param.name})`
            : `        if let ${param.name} { params["${param.name}"] = String(${param.name}) }`,
        )
        .join('\n')}`
    : 'let params: [String: String] = [:]';

  const body =
    intent.execution === 'api'
      ? `        ${paramDict}
        let speech = try await VoiceRunner.callServer(intent: "${intent.id}", params: params)
        return .result(dialog: IntentDialog(stringLiteral: speech))`
      : `        ${paramDict}
        if let url = VoiceRunner.appURL(intent: "${intent.id}", params: params) {
            await openURL(url)
        }
        return .result()`;

  const returnType =
    intent.execution === 'api' ? 'some IntentResult & ProvidesDialog' : 'some IntentResult';

  const openAppComment =
    intent.execution === 'api'
      ? '// Runs without launching the app — works from the lock screen.'
      : '// Must launch the app: the feature is client state (see the catalog).';

  const environment =
    intent.execution === 'deeplink' ? '\n    @Environment(\\.openURL) private var openURL\n' : '';

  return `/// ${title}${intent.drivingSafe ? '' : '  (not hands-free: the user still has to look)'}
struct ${name}: AppIntent {
    static let title: LocalizedStringResource = "${swiftString(title)}"
    ${openAppComment}
    static let openAppWhenRun: Bool = ${intent.execution === 'deeplink'}
${environment}${parameters ? `${parameters}\n` : ''}
    func perform() async throws -> ${returnType} {
${body}
    }
}`;
}

function swiftShortcut(intent: CatalogVoiceIntent): string {
  const phrases = intent.phrases[DEFAULT_LOCALE].map(
    (phrase) =>
      `                "${swiftString(phrase).replaceAll(APP_NAME_TOKEN, '\\(.applicationName)')}"`,
  ).join(',\n');
  return `        AppShortcut(
            intent: ${pascalCase(intent.id)}Intent(),
            phrases: [
${phrases}
            ],
            shortTitle: "${swiftString(intent.title[DEFAULT_LOCALE])}",
            systemImageName: "${intent.execution === 'api' ? 'mic.fill' : 'magnifyingglass'}"
        )`;
}

function generateSwift(): string {
  return `//
//  ${BANNER}
//
//  Support code (networking, keychain, URL building) is hand-written in
//  VoiceSupport.swift. Both files are injected into the Xcode project by
//  apps/mobile/plugins/withVoiceAssistants.ts.
//
//  Non-English phrases are NOT here: iOS localizes App Shortcut phrases
//  through AppShortcuts.<locale>.strings, also generated alongside this file.
//

import AppIntents
import Foundation
import SwiftUI

${VOICE_INTENTS.map(swiftIntent).join('\n\n')}

/// Registers the phrases with Siri and the Shortcuts app. iOS caps a provider
/// at 10 shortcuts; the catalog's own limit keeps us under it.
struct VoiceAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
${VOICE_INTENTS.map(swiftShortcut).join('\n')}
    }
}
`;
}

/**
 * `AppShortcuts.<locale>.strings` — Apple's localization mechanism for
 * shortcut phrases. The KEY is the English phrase with the app-name token in
 * Apple's `${applicationName}` form.
 */
function generateAppShortcutsStrings(locale: Locale): string {
  const lines: string[] = [`/* ${BANNER} */`, ''];
  for (const intent of VOICE_INTENTS) {
    lines.push(`/* ${intent.id} */`);
    const source = intent.phrases[DEFAULT_LOCALE];
    const target = intent.phrases[locale];
    for (const [index, phrase] of source.entries()) {
      const translated = target[index] ?? phrase;
      const key = phrase.replaceAll(APP_NAME_TOKEN, '${applicationName}');
      const value = translated.replaceAll(APP_NAME_TOKEN, '${applicationName}');
      lines.push(`"${swiftString(key)}" = "${swiftString(value)}";`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── Android (Google Assistant App Actions) ───────────────────────────────────

/** `voice/todos.search?query={query}` → `/voice/todos.search{?query}` */
function urlTemplate(intent: CatalogVoiceIntent): string {
  const path = `/${voiceLinkTemplate(intent).split('?')[0] ?? ''}`;
  if (intent.params.length === 0) return `__VOICE_LINK_ORIGIN__${path}`;
  return `__VOICE_LINK_ORIGIN__${path}{?${intent.params.map((p) => p.name).join(',')}}`;
}

function generateAndroidShortcuts(): string {
  // ONLY deeplink intents. A custom App Actions capability can do exactly one
  // thing — hand the request to the app via an app-link. It cannot call our
  // server and it cannot speak a result back, so exposing an `api` intent here
  // would launch the app and then do nothing (the RN registry ignores `api`
  // ids by design). On Android, spoken answers are Bixby's job.
  const capabilities = voiceIntentsBy('deeplink')
    .map((intent) => {
      const parameters = intent.params
        .map(
          (param) =>
            `            <parameter\n                android:name="${param.name}"\n                android:key="${param.name}"\n                android:required="${param.required}" />\n`,
        )
        .join('');
      return `    <!-- ${xmlAttr(intent.title[DEFAULT_LOCALE])}${
        intent.drivingSafe ? '' : ' (not hands-free)'
      } -->
    <capability android:name="custom.actions.intent.${screamingCase(intent.id)}">
        <app-link android:identifier="${intent.id}">
            <url-template android:value="${xmlAttr(urlTemplate(intent))}" />
${parameters}        </app-link>
    </capability>`;
    })
    .join('\n\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<!--
  ${BANNER}

  Google Assistant App Actions. Unlike Bixby this lives INSIDE the Android app,
  so it ships with the binary exactly like Siri's App Intents do.

  Contains the catalog's \`deeplink\` intents only — see the note in
  scripts/generate-voice-artifacts.ts for why \`api\` intents cannot appear
  here, and docs/voice-assistant.md for what that means on a Galaxy.

  __VOICE_LINK_ORIGIN__ is substituted at prebuild by
  apps/mobile/plugins/withVoiceAssistants.ts, from the verified App Link host
  in app.config.ts. Every URL here must be covered by an autoVerify
  intent-filter or Assistant will refuse to hand the request over.
-->
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">

${capabilities}

</shortcuts>
`;
}

// ── Bixby ────────────────────────────────────────────────────────────────────

/**
 * Bixby training files. Only `api` intents get them: a Capsule that merely
 * deep-links into the app can never report back what happened, so it cannot
 * answer the user — which is the whole reason to use Bixby at the wheel.
 */
function generateBixbyTraining(intent: CatalogVoiceIntent, locale: Locale): string {
  const action = pascalCase(intent.id);
  const utterances = intent.phrases[locale]
    .map((phrase) => {
      // Bixby has no app-name token, so the invocation name is spliced in
      // literally. Deleting it instead would leave dangling particles in
      // Korean ("에 할 일 추가") and an ungrammatical utterance trains badly.
      const text = phrase.replaceAll(APP_NAME_TOKEN, VOICE_INVOCATION_NAME);
      return `  utterance (${JSON.stringify(text)}) {\n    intent {\n      goal: ${action}\n    }\n  }`;
    })
    .join('\n');

  return `// ${BANNER}
//
// Open capsule/ in Bixby Developer Studio to compile and train. Slot values
// are added there against the concepts in models/ — an utterance file cannot
// declare them on its own.
train {
${utterances}
}
`;
}

// ── Driver ───────────────────────────────────────────────────────────────────

function artifacts(): Map<string, string> {
  const files = new Map<string, string>();
  files.set('apps/mobile/native/ios/VoiceIntents.generated.swift', generateSwift());
  files.set('apps/mobile/native/android/voice_shortcuts.generated.xml', generateAndroidShortcuts());

  for (const locale of SUPPORTED_LOCALES) {
    if (locale !== DEFAULT_LOCALE) {
      files.set(
        `apps/mobile/native/ios/AppShortcuts.${locale}.strings`,
        generateAppShortcutsStrings(locale),
      );
    }
    for (const intent of VOICE_INTENTS) {
      if (intent.execution !== 'api') continue;
      files.set(
        `capsule/boilerplate/resources/${locale}/training/${pascalCase(intent.id)}.training.bxb`,
        generateBixbyTraining(intent, locale),
      );
    }
  }
  return files;
}

async function main(): Promise<void> {
  // A malformed catalog must never reach a native artifact — by the time it
  // does, the failure has moved into Xcode or a Capsule build where nobody
  // will connect it back to a phrase list.
  const issues = voiceCatalogIssues(SUPPORTED_LOCALES);
  if (issues.length > 0) {
    console.error('Voice catalog is invalid:');
    for (const issue of issues) console.error(`  - ${issue}`);
    process.exit(1);
  }

  const files = artifacts();
  const check = process.argv.includes('--check');
  const stale: string[] = [];

  for (const [relative, content] of files) {
    const path = join(ROOT, relative);
    if (check) {
      const current = await readFile(path, 'utf8').catch(() => null);
      if (current !== content) stale.push(relative);
      continue;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }

  if (check) {
    if (stale.length > 0) {
      console.error('Voice artifacts are out of date — run `bun run voice:generate`:');
      for (const relative of stale) console.error(`  - ${relative}`);
      process.exit(1);
    }
    console.log(`voice: ${String(files.size)} artifacts up to date`);
    return;
  }
  console.log(`voice: wrote ${String(files.size)} artifacts`);
}

await main();
