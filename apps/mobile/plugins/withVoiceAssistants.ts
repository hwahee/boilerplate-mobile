/**
 * Expo config plugin — wires the generated assistant artifacts into the native
 * projects at prebuild.
 *
 * This repo is a CNG (Continuous Native Generation) project: `ios/` and
 * `android/` do not exist in git, they are produced by `expo prebuild`. So
 * Siri's App Intents cannot simply be "added in Xcode" — every native change
 * has to be expressible as a mod, or it is lost on the next prebuild. That is
 * what this file is.
 *
 * iOS
 *   - copies VoiceSupport.swift (hand-written) and VoiceIntents.generated.swift
 *     into the app target and registers them in the Xcode project
 *   - copies AppShortcuts.<locale>.strings into <locale>.lproj so Siri speaks
 *     the localized phrases
 *   - publishes the PUBLIC config the Swift needs via Info.plist
 *   - declares the Keychain access group the voice token will live in
 *
 * Android
 *   - writes res/xml/voice_shortcuts.xml with the verified App Link origin
 *     substituted in
 *   - points the launcher activity at it, which is what makes Google Assistant
 *     pick the capabilities up
 *
 * NOTE ON VERIFICATION: everything here runs at `expo prebuild` and is proven
 * only by a real native build. It has not been executed in this environment
 * (no Xcode, no Android SDK). Treat the first prebuild as the acceptance test —
 * docs/voice-assistant.md lists what to check.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  AndroidConfig,
  IOSConfig,
  withAndroidManifest,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
  type ConfigPlugin,
} from 'expo/config-plugins';

export interface VoiceAssistantsOptions {
  /**
   * Verified App Link origin substituted into the Android capabilities, e.g.
   * `https://app.example.com`. Must match an `autoVerify` intent-filter in
   * app.config.ts or Assistant refuses to hand requests over.
   */
  linkOrigin: string;
  /**
   * Custom URL scheme Siri opens for `deeplink` intents. Defaults to the app's
   * first configured scheme.
   */
  scheme?: string;
  /** API base URL the Swift App Intents call for `api` intents. */
  apiBaseUrl: string;
  /**
   * Keychain access group holding the voice token, shared between the app and
   * (later) an App Intents extension. Omit to skip the entitlement entirely.
   */
  keychainAccessGroup?: string;
  /** Locales with a generated AppShortcuts.<locale>.strings file. */
  localizedPhrases?: string[];
}

const NATIVE_DIR = join(__dirname, '..', 'native');
const IOS_SOURCES = ['VoiceSupport.swift', 'VoiceIntents.generated.swift'];
const ANDROID_RESOURCE = 'voice_shortcuts';
const LINK_ORIGIN_PLACEHOLDER = '__VOICE_LINK_ORIGIN__';

/** Public values the Swift reads at runtime. Never a secret — see app.config.ts. */
const withVoiceInfoPlist: ConfigPlugin<VoiceAssistantsOptions> = (config, options) =>
  withInfoPlist(config, (mod) => {
    const scheme = options.scheme ?? (Array.isArray(mod.scheme) ? mod.scheme[0] : mod.scheme);
    mod.modResults.VoiceApiBaseUrl = options.apiBaseUrl;
    mod.modResults.VoiceAppScheme = scheme ?? '';
    mod.modResults.VoiceKeychainAccessGroup = options.keychainAccessGroup ?? '';
    return mod;
  });

const withVoiceKeychainGroup: ConfigPlugin<VoiceAssistantsOptions> = (config, options) => {
  const sharedGroup = options.keychainAccessGroup;
  if (!sharedGroup) return config;
  return withEntitlementsPlist(config, (mod) => {
    const existing = mod.modResults['keychain-access-groups'];
    const groups = new Set(Array.isArray(existing) ? (existing as string[]) : []);

    // The app's OWN group must come FIRST. iOS uses the first entry as the
    // default access group for items saved without one — so listing the shared
    // group first would silently relocate everything expo-secure-store already
    // wrote, and the app would come back from an update with no stored data.
    const ordered = ['$(AppIdentifierPrefix)$(CFBundleIdentifier)', ...groups, sharedGroup].filter(
      (group, index, all) => all.indexOf(group) === index,
    );

    mod.modResults['keychain-access-groups'] = ordered;
    return mod;
  });
};

const withVoiceIosSources: ConfigPlugin<VoiceAssistantsOptions> = (config, options) =>
  withXcodeProject(config, (mod) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
    const targetDir = join(mod.modRequest.platformProjectRoot, projectName);
    mkdirSync(targetDir, { recursive: true });

    for (const filename of IOS_SOURCES) {
      const source = join(NATIVE_DIR, 'ios', filename);
      if (!existsSync(source)) {
        throw new Error(
          `[withVoiceAssistants] missing ${source} — run \`bun run voice:generate\` first.`,
        );
      }
      copyFileSync(source, join(targetDir, filename));
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: `${projectName}/${filename}`,
        groupName: projectName,
        // The `xcode` package ships no types, so Expo's XcodeProject is an
        // `error` type here. It is opaque to us either way — we only hand it
        // straight back to Expo's own helper.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        project: mod.modResults,
      });
    }

    // Siri reads App Shortcut phrases from AppShortcuts.strings, one per
    // localization — the phrases themselves stay English in the Swift.
    for (const locale of options.localizedPhrases ?? []) {
      const source = join(NATIVE_DIR, 'ios', `AppShortcuts.${locale}.strings`);
      if (!existsSync(source)) continue;
      const destination = join(targetDir, `${locale}.lproj`, 'AppShortcuts.strings');
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(source, destination);
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: `${projectName}/${locale}.lproj/AppShortcuts.strings`,
        groupName: projectName,
        // The `xcode` package ships no types, so Expo's XcodeProject is an
        // `error` type here. It is opaque to us either way — we only hand it
        // straight back to Expo's own helper.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        project: mod.modResults,
      });
    }

    return mod;
  });

const withVoiceAndroidShortcuts: ConfigPlugin<VoiceAssistantsOptions> = (config, options) =>
  withDangerousMod(config, [
    'android',
    (mod) => {
      const source = join(NATIVE_DIR, 'android', `${ANDROID_RESOURCE}.generated.xml`);
      if (!existsSync(source)) {
        throw new Error(
          `[withVoiceAssistants] missing ${source} — run \`bun run voice:generate\` first.`,
        );
      }
      const xml = readFileSync(source, 'utf8').replaceAll(
        LINK_ORIGIN_PLACEHOLDER,
        options.linkOrigin.replace(/\/$/, ''),
      );
      const destination = join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
        `${ANDROID_RESOURCE}.xml`,
      );
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, xml, 'utf8');
      return mod;
    },
  ]);

/**
 * `<meta-data>` is valid on an activity but absent from Expo's `ManifestActivity`
 * type, so the node is reached through this narrow local shape rather than a
 * blanket `any`.
 */
interface ActivityWithMetaData {
  'meta-data'?: { $: Record<string, string> }[];
}

const withVoiceAndroidManifest: ConfigPlugin = (config) =>
  withAndroidManifest(config, (mod) => {
    // App Actions capabilities hang off the LAUNCHER activity, not the
    // application node — Assistant looks them up per entry point.
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(
      mod.modResults,
    ) as unknown as ActivityWithMetaData;
    const metaData = (activity['meta-data'] ??= []);
    const name = 'android.app.shortcuts';
    const existing = metaData.find((item) => item.$['android:name'] === name);
    if (existing) {
      existing.$['android:resource'] = `@xml/${ANDROID_RESOURCE}`;
    } else {
      metaData.push({
        $: { 'android:name': name, 'android:resource': `@xml/${ANDROID_RESOURCE}` },
      });
    }
    return mod;
  });

export const withVoiceAssistants: ConfigPlugin<VoiceAssistantsOptions> = (config, options) => {
  let next = withVoiceInfoPlist(config, options);
  next = withVoiceKeychainGroup(next, options);
  next = withVoiceIosSources(next, options);
  next = withVoiceAndroidShortcuts(next, options);
  next = withVoiceAndroidManifest(next);
  return next;
};

export default withVoiceAssistants;
