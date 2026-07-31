/**
 * Voice authentication seam.
 *
 * Why voice needs its own credential at all: an `api` intent is executed by
 * code that lives OUTSIDE the app's session — a Swift App Intent in a separate
 * process on iOS, and on Bixby a Capsule running on Samsung's cloud, which can
 * never see the device keychain. Neither can borrow the app's login state.
 *
 * The shape below is the one to keep when real auth arrives: mint a SEPARATE,
 * narrowly-scoped voice token at login instead of sharing the session token.
 * A credential that sits in a lock-screen-reachable process should be able to
 * do the four things in the catalog and nothing else, and should be revocable
 * on its own.
 *
 *   iOS    the token is written to a Keychain access group shared with the
 *          App Intents target (see docs/voice-assistant.md)
 *   Bixby  the token is the result of OAuth2 account linking, held by Samsung
 *   Google App Actions launch the app, so `deeplink` intents need no token
 *
 * Auth is out of scope for this boilerplate, exactly as in
 * apps/mobile/src/storage/secure-store.ts — so the shipped implementation is
 * a single shared secret from configuration, and the whole voice API is
 * DISABLED when it is unset (same stance as ADMIN_TOKEN: no default token,
 * no anonymous mode). Swap `createStaticVoiceTokenVerifier` for a real
 * verifier and nothing downstream changes.
 */
import type { VoiceScope } from '@shared/voice/catalog';

/**
 * Who a voice call acts as, and what it is allowed to do.
 * @public the shape a real verifier must return
 */
export interface VoiceIdentity {
  /**
   * Whose data this call reads/writes. With the static verifier there is one
   * shared subject; a real implementation returns the linked user's id.
   */
  readonly subject: string;
  readonly scopes: readonly VoiceScope[];
}

export interface VoiceTokenVerifier {
  /** Resolves the caller, or `null` when the token is absent/invalid/expired. */
  verify(token: string | null): Promise<VoiceIdentity | null>;
}

/** Constant-time-ish comparison — avoids leaking the secret's prefix by timing. */
function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Subject used while there are no user accounts to link a voice token to. */
const SHARED_VOICE_SUBJECT = 'shared';

export function createStaticVoiceTokenVerifier(
  configuredToken: string | undefined,
  scopes: readonly VoiceScope[],
): VoiceTokenVerifier {
  return {
    verify(token) {
      if (!configuredToken || !token) return Promise.resolve(null);
      if (!tokensMatch(token, configuredToken)) return Promise.resolve(null);
      return Promise.resolve({ subject: SHARED_VOICE_SUBJECT, scopes });
    },
  };
}
