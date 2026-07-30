/**
 * Route plumbing shared by every API endpoint:
 *
 *   - JSON responses
 *   - the repo-wide error envelope (@shared/api/errors), localized
 *   - deployment-version handshake for browser clients (@shared/api/version)
 *   - the app-version upgrade gate for native clients (426, ./version-gate.ts)
 *   - CORS preflight + response headers
 *   - mapping of domain errors (ValidationError, NotFoundError, …) to HTTP
 */
import type { ApiErrorBody, ApiErrorCode } from '@shared/api/errors';
import { PLATFORM_HEADER } from '@shared/api/headers';
import { APP_VERSION, VERSION_HEADER } from '@shared/api/version';
import type { MessageKey } from '@shared/i18n';
import { ValidationError } from '@shared/validation';

import type { ServerConfig } from '../config';
import { NotFoundError, UnauthorizedError, UpgradeRequiredError } from '../lib/errors';
import type { Logger } from '../lib/log';
import { createRequestContext, type RequestContext } from './context';
import { corsHeaders, preflightResponse } from './cors';

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...init.headers },
  });
}

const ERROR_MESSAGE_KEYS: Record<ApiErrorCode, MessageKey> = {
  VALIDATION_ERROR: 'error.validation',
  NOT_FOUND: 'error.notFound',
  UNAUTHORIZED: 'error.unauthorized',
  VERSION_MISMATCH: 'error.versionMismatch',
  UPGRADE_REQUIRED: 'error.upgradeRequired',
  INTERNAL_ERROR: 'error.internal',
};

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  ctx: RequestContext,
  details?: unknown,
): Response {
  const body: ApiErrorBody = {
    error: {
      code,
      message: ctx.t(ERROR_MESSAGE_KEYS[code]),
      ...(details === undefined ? {} : { details }),
    },
  };
  return json(body, { status });
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type ApiHandler<P extends string> = (
  req: Bun.BunRequest<P>,
  ctx: RequestContext,
) => Promise<Response>;

/**
 * Pre-handler check derived from the client-identification headers; returns
 * a response (e.g. 426) to short-circuit the request. See ./version-gate.ts.
 */
export type VersionGate = (req: Request, ctx: RequestContext) => Promise<Response | undefined>;

export interface HttpDeps {
  config: ServerConfig;
  log: Logger;
  /**
   * Upgrade gate for native app clients. Optional so browser-only route sets
   * (and unit tests) need no extra wiring; omitted means "never block".
   */
  versionGate?: VersionGate;
}

/**
 * Wraps a set of method handlers into a Bun `routes` entry with the shared
 * middleware behavior applied (preflight, version checks, error mapping,
 * CORS response headers).
 */
export function apiRoute<P extends string>(
  handlers: Partial<Record<Method, ApiHandler<P>>>,
  deps: HttpDeps,
): Record<string, (req: Bun.BunRequest<P>) => Promise<Response>> {
  const wrap =
    (handler: ApiHandler<P>) =>
    async (req: Bun.BunRequest<P>): Promise<Response> => {
      const ctx = createRequestContext(req);
      let response: Response;
      try {
        response =
          (await deps.versionGate?.(req, ctx)) ??
          checkVersion(req, ctx) ??
          (await handler(req, ctx));
      } catch (error) {
        response = mapError(error, ctx, deps.log);
      }
      // Append CORS headers for allowed cross-origin callers.
      for (const [name, value] of Object.entries(corsHeaders(req, deps.config.corsOrigins))) {
        response.headers.set(name, value);
      }
      return response;
    };

  const route: Record<string, (req: Bun.BunRequest<P>) => Promise<Response>> = {
    OPTIONS: (req) => Promise.resolve(preflightResponse(req, deps.config.corsOrigins)),
  };
  for (const [method, handler] of Object.entries(handlers)) {
    route[method] = wrap(handler);
  }
  return route;
}

/**
 * Deployment-version handshake: reject BROWSER clients built from a different
 * bundle than this server (rolling-deploy skew). See @shared/api/version.
 *
 * Native clients send the same header carrying an app-store semver, which has
 * nothing to do with the deployed build — they identify themselves with
 * `X-Platform` and are handled by the upgrade gate instead (./version-gate.ts).
 * The browser client never sends `X-Platform`, so its presence is the switch
 * between the two checks.
 */
function checkVersion(req: Request, ctx: RequestContext): Response | undefined {
  if (req.headers.get(PLATFORM_HEADER) !== null) return undefined;
  const clientVersion = req.headers.get(VERSION_HEADER);
  if (clientVersion !== null && clientVersion !== APP_VERSION) {
    return errorResponse(409, 'VERSION_MISMATCH', ctx, {
      client: clientVersion,
      server: APP_VERSION,
    });
  }
  return undefined;
}

function mapError(error: unknown, ctx: RequestContext, log: Logger): Response {
  if (error instanceof ValidationError) {
    return errorResponse(400, 'VALIDATION_ERROR', ctx, error.issues);
  }
  if (error instanceof SyntaxError) {
    // Malformed JSON body is the caller's problem, not a server fault.
    return errorResponse(400, 'VALIDATION_ERROR', ctx, [
      { path: '', message: 'Request body is not valid JSON', code: 'invalid_json' },
    ]);
  }
  if (error instanceof NotFoundError) {
    return errorResponse(404, 'NOT_FOUND', ctx, { resource: error.resource, id: error.id });
  }
  if (error instanceof UnauthorizedError) {
    return errorResponse(401, 'UNAUTHORIZED', ctx);
  }
  if (error instanceof UpgradeRequiredError) {
    return errorResponse(426, 'UPGRADE_REQUIRED', ctx, error.details);
  }
  log.error('unhandled error in api handler', {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
  return errorResponse(500, 'INTERNAL_ERROR', ctx);
}
