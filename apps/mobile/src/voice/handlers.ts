/**
 * ═══ WHERE VOICE COMMANDS ACTUALLY RUN ═══
 *
 * Siri, Bixby and Google Assistant each enter the app through a different
 * native stub, and all three converge here: the stub opens
 * `…://voice/<intent>?<slots>`, and this registry executes it. One
 * implementation per feature, in the language the feature is already written
 * in — which is the entire point of the arrangement (see
 * docs/voice-assistant.md).
 *
 * The map is total over {@link DeepLinkVoiceIntentId}, so adding a `deeplink`
 * intent to the shared catalog fails to compile until it is handled here.
 *
 * Handlers must be SAFE TO RUN AT ANY MOMENT: the user is driving, the app may
 * have been backgrounded for days, and nothing has been rendered yet on a cold
 * start. Navigate, dispatch, fire a mutation — do not assume a screen is
 * mounted, and never block.
 */
import {
  findVoiceIntent,
  voiceParamsValidator,
  type DeepLinkVoiceIntentId,
} from '@shared/voice/catalog';
import { parseVoiceLink } from '@shared/voice/link';

import { navigationRef } from '../navigation/ref';

type VoiceHandler = (params: Record<string, unknown>) => void;

const HANDLERS: Record<DeepLinkVoiceIntentId, VoiceHandler> = {
  'todos.open': () => {
    navigationRef.navigate('Main', { screen: 'TodosTab', params: {} });
  },

  'todos.search': (params) => {
    // The term lives in the route (navigation params ARE the state), so the
    // screen renders it and a second search replaces rather than stacks.
    navigationRef.navigate('Main', { screen: 'TodosTab', params: { q: String(params.query) } });
  },
};

/**
 * A voice link that arrived before the navigator was ready. Exactly one is
 * kept: on a cold start the OS delivers the launch URL first, and if a second
 * command somehow beat the navigator, the newer one is what the user just
 * said.
 */
let pending: string | null = null;

/**
 * Runs the command in `url`.
 *
 * Returns whether the URL was a voice link at all — `false` means an ordinary
 * deep link, which React Navigation's linking config handles instead.
 * Never throws: this sits on the OS URL callback path.
 */
export function handleVoiceUrl(url: string): boolean {
  const link = parseVoiceLink(url);
  if (!link) return false;

  // Queue until the navigator exists, then replay from flushPendingVoiceUrl.
  if (!navigationRef.isReady()) {
    pending = url;
    return true;
  }
  pending = null;

  const intent = findVoiceIntent(link.intentId);
  // Unknown id, or an `api` intent that should never have opened the app:
  // an older binary can receive commands a newer assistant surface sends, so
  // this is a normal condition, not an error to surface.
  if (intent?.execution !== 'deeplink') return true;

  const parsed = voiceParamsValidator(intent).safeParse(link.params);
  if (!parsed.ok) return true;

  HANDLERS[intent.id](parsed.value);
  return true;
}

/** Replays the queued launch command. Call once the navigator is ready. */
export function flushPendingVoiceUrl(): void {
  const url = pending;
  pending = null;
  if (url !== null) handleVoiceUrl(url);
}
