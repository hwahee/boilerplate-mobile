/**
 * Assembles the HTTP surface (API routes + WebSocket) as plain data, separate
 * from `Bun.serve` so integration tests can boot the exact same app on an
 * ephemeral port. The static client routes are added only by the real
 * entrypoint (src/server/index.ts).
 */
import type { Container } from './container';
import type { HttpDeps } from './http/respond';
import { createVersionGate, noVersionGate } from './http/version-gate';
import { CHANNELS } from './pubsub';
import {
  adminAppConfigRoute,
  adminPushBroadcastRoute,
  adminVersionPolicyRoute,
} from './routes/admin';
import { appConfigRoute } from './routes/app-config';
import { livenessRoute, readinessRoute, type AppState } from './routes/health';
import { pushTokenRoutes, pushTokenUnregisterRoute } from './routes/push-tokens';
import { todoCollectionRoutes, todoItemRoutes } from './routes/todos';
import { versionPolicyRoute } from './routes/version-policy';
import { voiceIntentRoute } from './routes/voice';

/** Server-side WebSocket topic that todo change events are published to. */
const WS_TOPIC_TODOS = 'ws.todos';
/** Server-side WebSocket topic for remote-config change events (mobile app). */
const WS_TOPIC_CONFIG = 'ws.config';

export function buildApp(container: Container, state: AppState) {
  const deps: HttpDeps = {
    config: container.config,
    log: container.log,
    versionGate: createVersionGate(container.versionPolicyService()),
  };
  // The endpoints an OUTDATED app must still reach (to learn how to update /
  // whether maintenance is on) are exempt from the 426 gate.
  const ungatedDeps: HttpDeps = { ...deps, versionGate: noVersionGate };

  return {
    routes: {
      '/api/health/live': livenessRoute(),
      '/api/health/ready': readinessRoute(container, state),
      '/api/version-policy': versionPolicyRoute(container, ungatedDeps),
      '/api/app-config': appConfigRoute(container, ungatedDeps),
      '/api/todos': todoCollectionRoutes(container, deps),
      '/api/todos/:id': todoItemRoutes(container, deps),
      // Ungated: the callers are assistants (a Bixby Capsule on Samsung's
      // cloud, a Swift App Intent), not app binaries with a store version.
      '/api/voice/:intentId': voiceIntentRoute(container, ungatedDeps),
      '/api/push-tokens': pushTokenRoutes(container, deps),
      '/api/push-tokens/unregister': pushTokenUnregisterRoute(container, deps),
      '/api/admin/version-policy/:platform': adminVersionPolicyRoute(container, deps),
      '/api/admin/app-config/:key': adminAppConfigRoute(container, deps),
      '/api/admin/push/broadcast': adminPushBroadcastRoute(container, deps),
      /** WebSocket endpoint: pushes `{action, todoId}` on every todo change. */
      '/ws': (req: Bun.BunRequest<'/ws'>, server: Bun.Server<undefined>) =>
        server.upgrade(req)
          ? undefined
          : new Response('WebSocket upgrade required', { status: 426 }),
    },

    websocket: {
      open(ws: Bun.ServerWebSocket<undefined>) {
        // Every socket joins both topics; bridgePubSubToWebSocket relays the
        // pub/sub bus into them, so this works across instances with the
        // redis driver.
        ws.subscribe(WS_TOPIC_TODOS);
        ws.subscribe(WS_TOPIC_CONFIG);
      },
      message() {
        // Inbound messages are not part of the protocol (yet).
      },
    },

    /** Fallback for anything no route matched (API-only mode, e.g. tests). */
    fetch: () => new Response('Not Found', { status: 404 }),
  };
}

/**
 * Bridge: pub/sub bus → WebSocket clients connected to THIS instance.
 * With PUBSUB_DRIVER=redis this fans out across all instances. Returns a
 * cleanup function for graceful shutdown.
 *
 * Todo events keep their bare `{action, todoId}` payload (the browser client
 * just invalidates its queries); config events are tagged with a `type` so
 * the app can tell the two streams apart on one socket.
 */
export async function bridgePubSubToWebSocket(
  server: Bun.Server<undefined>,
  container: Container,
): Promise<() => Promise<void>> {
  const pubsub = container.pubsub();
  const unsubscribes = [
    await pubsub.subscribe(CHANNELS.todosChanged, (message) =>
      server.publish(WS_TOPIC_TODOS, JSON.stringify(message)),
    ),
    await pubsub.subscribe(CHANNELS.configChanged, (message) =>
      server.publish(
        WS_TOPIC_CONFIG,
        JSON.stringify({ type: 'config.changed', ...(message as object) }),
      ),
    ),
    // Cross-instance cache invalidation for the version policy (the 426 gate
    // serves from a per-process cache; see VersionPolicyService).
    await pubsub.subscribe(CHANNELS.versionPolicyChanged, () =>
      container.versionPolicyService().invalidate(),
    ),
  ];
  return async () => {
    for (const unsubscribe of unsubscribes) await unsubscribe();
  };
}
