/**
 * POST /api/voice/:intentId — the endpoint Siri's App Intent and Bixby's
 * Capsule call directly, without the app being open.
 *
 * Only `api`-mode intents are reachable here; `deeplink` intents are executed
 * inside the app and have no server representation (a request for one is a
 * 404, not a 400 — from the caller's side that id simply is not a server
 * resource).
 *
 * Deliberately mounted UNGATED (no 426 upgrade check): the callers are not app
 * binaries. A Bixby Capsule has no app version at all, and an App Intent may
 * outlive the JS bundle it shipped with. Version skew is handled the way every
 * other wire contract handles it — additive changes only (see
 * docs/release-playbook.md).
 *
 * Auth: `Authorization: Bearer <voice token>` + a per-intent scope. See
 * services/voice-token-service.ts for why voice gets its own credential.
 */
import { findVoiceIntent, voiceParamsValidator } from '@shared/voice/catalog';

import type { Container } from '../container';
import { apiRoute, json, type HttpDeps } from '../http/respond';
import { NotFoundError, UnauthorizedError } from '../lib/errors';

export function voiceIntentRoute(container: Container, deps: HttpDeps) {
  return apiRoute<'/api/voice/:intentId'>(
    {
      /**
       * POST /api/voice/:intentId {…slots} → { speech, data }
       * Errors: 404 NOT_FOUND (unknown or non-`api` intent),
       *         401 UNAUTHORIZED (missing/invalid token, or missing scope),
       *         400 VALIDATION_ERROR (bad slot values).
       */
      POST: async (req, ctx) => {
        const { intentId } = req.params;
        const intent = findVoiceIntent(intentId);
        if (intent?.execution !== 'api') {
          throw new NotFoundError('voiceIntent', intentId);
        }

        const header = req.headers.get('authorization');
        const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
        const identity = await container.voiceTokenVerifier().verify(token);
        if (!identity?.scopes.includes(intent.scope)) {
          throw new UnauthorizedError();
        }

        // An assistant may hand over an empty body when the intent has no
        // slots; treat that as `{}` rather than a JSON syntax error.
        const raw: unknown = req.headers.get('content-length') === '0' ? {} : await req.json();
        const params = voiceParamsValidator(intent).parse(raw);

        // `ctx.t` is passed as an arrow rather than a bare method reference:
        // it is bound to the request's locale and must not be detached.
        const result = await container
          .voiceService()
          .execute(intent.id, params, (key, values) => ctx.t(key, values));
        return json(result);
      },
    },
    deps,
  );
}
