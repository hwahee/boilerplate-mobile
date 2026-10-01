/** Domain-level errors thrown by services, mapped to HTTP by the route layer. */
import type { UpgradeRequiredDetails } from '@shared/api/errors';

export class NotFoundError extends Error {
  constructor(
    readonly resource: string,
    readonly id: string,
  ) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

/**
 * No (valid) credentials → HTTP 401: an operation that needs a signed-in user
 * called without one, or an admin endpoint called without its bearer token.
 */
export class UnauthorizedError extends Error {
  constructor() {
    super('authentication required');
    this.name = 'UnauthorizedError';
  }
}

/** Calling app build is below `minSupportedVersion` → HTTP 426. */
export class UpgradeRequiredError extends Error {
  constructor(readonly details: UpgradeRequiredDetails) {
    super(`App version ${details.clientVersion} is below ${details.minSupportedVersion}`);
    this.name = 'UpgradeRequiredError';
  }
}
