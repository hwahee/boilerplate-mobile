/**
 * Development API URL from the dev server the app was loaded from.
 *
 * In development the bundle comes from Metro on the developer's machine, and
 * `hostUri` is that machine as THIS device reached it ("192.168.0.5:8081" on a
 * phone over Wi-Fi, a WSL address, "10.0.2.2:8081" on an Android emulator…).
 * The API server runs on the same machine, so the same host on the API port
 * works wherever Metro does — no EXPO_PUBLIC_API_URL needed per device.
 *
 * A tunnel host (`expo start --tunnel`) forwards Metro's port only, so it
 * yields nothing and the caller falls back.
 */
const TUNNEL_SUFFIXES = ['.exp.direct', '.ngrok.io', '.ngrok-free.app'];

export function devApiUrlFrom(hostUri: unknown, apiPort = 3000): string | undefined {
  if (typeof hostUri !== 'string' || hostUri === '') return undefined;
  const host = hostUri
    .replace(/^[a-z]+:\/\//, '')
    .split('/')[0]!
    .replace(/:\d+$/, '');
  if (host === '' || TUNNEL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return undefined;
  return `http://${host}:${apiPort}`;
}
