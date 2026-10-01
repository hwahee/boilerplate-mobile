/**
 * API error envelope — the single error shape every endpoint returns.
 *
 * Example:
 *   HTTP 400
 *   { "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ … ] } }
 *
 * `message` is localized (Accept-Language / ?lang=), `code` is stable and
 * machine-readable — clients must branch on `code`, never on `message`.
 *
 * Version-skew rule: codes may be ADDED over time but never removed or
 * repurposed — old app builds in the field switch on them.
 */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  /**
   * 401 — the request carries no (valid) credentials: a signed-out caller of a
   * members-only route, or a missing/invalid admin token.
   */
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  /** Browser build ≠ server build during a rolling deploy — HTTP 409. */
  | 'VERSION_MISMATCH'
  /** The calling app version is below `minSupportedVersion` — HTTP 426. */
  | 'UPGRADE_REQUIRED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Optional structured detail, e.g. validation issues or upgrade info. */
    details?: unknown;
  };
}

/** Payload of `details` on an `UPGRADE_REQUIRED` (426) response. */
export interface UpgradeRequiredDetails {
  platform: string;
  clientVersion: string;
  minSupportedVersion: string;
  /** Where the update lives — App Store / Play Store page. */
  storeUrl: string;
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error: unknown = value.error;
  return (
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
  );
}
