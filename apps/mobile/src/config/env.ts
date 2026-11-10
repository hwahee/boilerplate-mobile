/**
 * App environment — the runtime view of app.config.ts.
 *
 * Everything environment-dependent the app needs (API base URL, environment
 * name, its own version) is resolved HERE, once. No other module reads
 * expo-constants or process.env directly.
 *
 * Local-dev networking — the API base URL, first match wins:
 *   1. EXPO_PUBLIC_API_URL (or the profile's URL in staging/production)
 *   2. development: the host Metro was reached on, port 3000 (dev-api-url.ts)
 *      — works on a phone over Wi-Fi, WSL, emulators and simulators alike
 *   3. no dev server host (a tunnel): localhost (iOS) / 10.0.2.2 (Android)
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { Platform as ApiPlatform } from '@shared/domain/platform';

import { devApiUrlFrom } from './dev-api-url';

/** @public part of the env contract */
export type AppEnv = 'development' | 'staging' | 'production';

interface Extra {
  appEnv?: AppEnv;
  apiBaseUrl?: string | null;
}

const extra: Extra = Constants.expoConfig?.extra ?? {};

function defaultDevBaseUrl(): string {
  // The machine Metro served this bundle from also runs the API — reach it the
  // same way (phone on Wi-Fi, WSL, emulator alike). See dev-api-url.ts.
  const fromDevServer = __DEV__ ? devApiUrlFrom(Constants.expoConfig?.hostUri) : undefined;
  if (fromDevServer) return fromDevServer;
  // No dev server host (e.g. a tunnel): Android emulators reach the host
  // machine via 10.0.2.2, iOS simulators via localhost.
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}

// `extra` arrives from the manifest, not from our types: only a non-empty
// string is a URL (SDK 58 delivers a null value as `{}`, for one).
const apiBaseUrl =
  typeof extra.apiBaseUrl === 'string' && extra.apiBaseUrl !== ''
    ? extra.apiBaseUrl
    : defaultDevBaseUrl();

export const env = {
  appEnv: extra.appEnv ?? 'development',
  apiBaseUrl,
  /** ws(s):// twin of the API base URL, for the remote-config push socket. */
  wsUrl: `${apiBaseUrl.replace(/^http/, 'ws')}/ws`,
  /** The binary's semver — single source of truth is `version` in app.config.ts. */
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  /** Narrowed platform for API headers ('ios' | 'android' only — see support matrix). */
  platform: (Platform.OS === 'android' ? 'android' : 'ios') satisfies ApiPlatform,
  isDev: __DEV__,
} as const;
