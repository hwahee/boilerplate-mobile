/**
 * Client-identification headers — sent by the mobile app on EVERY request.
 *
 * A browser tab can be force-refreshed; an installed app cannot. Old app
 * versions stay in the field for weeks, so the server needs to know exactly
 * which app version and platform is calling in order to
 *
 *   - keep responses backward-compatible (see docs/release-playbook.md), and
 *   - reject end-of-life versions with HTTP 426 `UPGRADE_REQUIRED` based on
 *     the version policy (the ONLY sanctioned way to break compatibility:
 *     raise `minSupportedVersion` and force-update the stragglers).
 *
 * Requests WITHOUT `X-Platform` (the browser client, curl, health probes,
 * admin tooling) bypass the upgrade gate entirely — it targets app builds,
 * not humans.
 */
import { VERSION_HEADER } from './version';

/**
 * App binary version, plain semver — e.g. `1.4.2`.
 *
 * Deliberately the SAME header the browser client uses for the rolling-deploy
 * handshake (@shared/api/version): the two clients carry different kinds of
 * version string, and the server tells them apart by `X-Platform` — native
 * requests are checked against the version policy, everything else against
 * the deployed build.
 */
export const APP_VERSION_HEADER = VERSION_HEADER;

/** Client platform: `ios` | `android`. Absent for the browser client. */
export const PLATFORM_HEADER = 'x-platform';
