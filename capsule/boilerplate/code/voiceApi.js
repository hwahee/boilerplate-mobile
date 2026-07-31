/**
 * Shared transport for every action in this capsule.
 *
 * This is the Bixby half of the "one execution path" rule: it calls exactly
 * the same POST /api/voice/<id> endpoint that the Swift App Intent calls
 * (apps/mobile/native/ios/VoiceSupport.swift). Neither side reimplements the
 * feature — the server owns it, both assistants just speak the answer.
 *
 * ── Authentication ─────────────────────────────────────────────────────────
 * The capsule runs on Samsung's cloud, so it cannot read the device keychain
 * the way the Swift intent can. The token below comes from capsule
 * configuration, which is the boilerplate's stand-in for OAuth2 account
 * linking. Before shipping to real users, replace `config.get('secret.voiceToken')`
 * with `$vivContext.accessToken` from a linked account — a shared secret means
 * every Bixby user acts as the same subject. See docs/voice-assistant.md.
 */
const http = require('http');
const config = require('config');
const fail = require('fail');

/**
 * @param {string} intentId  id from src/shared/voice/catalog.ts, e.g. 'todo.create'
 * @param {object} params    slot values, already collected by Bixby
 * @returns {string}         the sentence to speak
 */
module.exports.run = function run(intentId, params) {
  const baseUrl = config.get('remote.apiBaseUrl');
  const token = config.get('secret.voiceToken');

  if (!baseUrl || !token) {
    // A capsule with no credentials is a configuration mistake, not a user
    // error — say something actionable rather than reading a stack trace out.
    throw fail.checkedError('Capsule is not configured', 'NotConfigured', {});
  }

  const response = http.postUrl(`${baseUrl}/api/voice/${intentId}`, params || {}, {
    format: 'json',
    headers: {
      Authorization: `Bearer ${token}`,
      // Bixby resolves the locale per request; the server localizes the answer
      // from the same catalog the app uses (@shared/i18n).
      'Accept-Language': $vivContext.locale || 'en',
    },
    // A moving car produces dead zones. Fail fast and let Bixby say so.
    timeout: 10000,
  });

  if (!response || typeof response.speech !== 'string') {
    throw fail.checkedError('Unexpected response', 'UpstreamError', {});
  }
  return response.speech;
};
