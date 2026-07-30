/**
 * Explicit CORS management. The allowlist comes exclusively from
 * configuration (CORS_ORIGINS) — there is no wildcard and no implicit allow.
 * Same-origin requests (no Origin header, or Origin matching the host) are
 * unaffected by CORS entirely.
 */
import { PLATFORM_HEADER } from '@shared/api/headers';
import { VERSION_HEADER } from '@shared/api/version';

const ALLOWED_METHODS = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
// `authorization` is for the admin API; `x-platform` for native callers.
// (Native apps are not subject to CORS at all — this is for browser callers.)
const ALLOWED_HEADERS = `content-type, accept-language, authorization, ${VERSION_HEADER}, ${PLATFORM_HEADER}`;

function isOriginAllowed(origin: string | null, allowedOrigins: readonly string[]): boolean {
  return origin !== null && allowedOrigins.includes(origin);
}

/** Headers to append to an actual (non-preflight) response, if any. */
export function corsHeaders(
  req: Request,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!isOriginAllowed(origin, allowedOrigins)) return {};
  return {
    'access-control-allow-origin': origin!,
    vary: 'Origin',
  };
}

/** Response to an OPTIONS preflight. */
export function preflightResponse(req: Request, allowedOrigins: readonly string[]): Response {
  const origin = req.headers.get('origin');
  if (!isOriginAllowed(origin, allowedOrigins)) {
    // Not an allowed cross-origin caller — deny without CORS headers.
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin!,
      'access-control-allow-methods': ALLOWED_METHODS,
      'access-control-allow-headers': ALLOWED_HEADERS,
      'access-control-max-age': '86400',
      vary: 'Origin',
    },
  });
}
