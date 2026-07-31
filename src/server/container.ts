/**
 * Composition root — a tiny, typed service container.
 *
 * Everything resolved through the container is a per-process SINGLETON:
 * the factory runs once (lazily, on first access) and the instance is
 * memoized. When a future service must be a singleton (a scheduler, a cache,
 * a metrics registry, …), register it here the same way — consumers never
 * construct services themselves.
 *
 * The container also owns driver selection (postgres vs memory persistence,
 * memory vs redis pub/sub, dry-run vs expo push), so swapping infrastructure
 * is invisible to services and routes.
 */
import { VOICE_SCOPES } from '@shared/voice/catalog';

import type { ServerConfig } from './config';
import { createPostgresDb, createPostgresUnitOfWork, type PostgresDb } from './db/postgres';
import { createLogger, type Logger } from './lib/log';
import { createPubSub, type PubSub } from './pubsub';
import { createPushSender, type PushSender } from './push';
import {
  createMemoryAppConfigRepository,
  createMemoryAuditLogRepository,
  createMemoryPushTokenRepository,
  createMemoryTodoRepository,
  createMemoryUnitOfWork,
  createMemoryVersionPolicyRepository,
  MemoryStore,
} from './repositories/memory';
import {
  createPostgresAppConfigRepository,
  createPostgresAuditLogRepository,
  createPostgresPushTokenRepository,
  createPostgresTodoRepository,
  createPostgresVersionPolicyRepository,
} from './repositories/postgres';
import type {
  AppConfigRepository,
  AuditLogRepository,
  PushTokenRepository,
  TodoRepository,
  UnitOfWork,
  VersionPolicyRepository,
} from './repositories/types';
import { AppConfigService } from './services/app-config-service';
import { PushTokenService } from './services/push-token-service';
import { TodoService } from './services/todo-service';
import { VersionPolicyService } from './services/version-policy-service';
import { VoiceService } from './services/voice-service';
import {
  createStaticVoiceTokenVerifier,
  type VoiceTokenVerifier,
} from './services/voice-token-service';

export interface Container {
  readonly config: ServerConfig;
  readonly log: Logger;
  todoService(): TodoService;
  versionPolicyService(): VersionPolicyService;
  appConfigService(): AppConfigService;
  pushTokenService(): PushTokenService;
  /** Executes the `api`-mode voice intents (Siri / Bixby call these). */
  voiceService(): VoiceService;
  /** Resolves the caller of /api/voice/* — the swap point for real auth. */
  voiceTokenVerifier(): VoiceTokenVerifier;
  pubsub(): PubSub;
  /** Health probe: is the persistence layer reachable? */
  dbPing(): Promise<boolean>;
  /** Closes every held resource (DB pool, pub/sub connections). */
  dispose(): Promise<void>;
}

/** Memoizes a factory — the singleton primitive used for every service. */
function lazy<T>(factory: () => T): () => T {
  let created = false;
  let value: T;
  return () => {
    if (!created) {
      value = factory();
      created = true;
    }
    return value;
  };
}

export interface ContainerOverrides {
  log?: Logger;
  pubsub?: PubSub;
  pushSender?: PushSender;
  /** Shrink the version-policy cache TTL in tests. */
  versionPolicyCacheTtlMs?: number;
  /** Stand in for real voice auth (per-user tokens, OAuth account linking). */
  voiceTokenVerifier?: VoiceTokenVerifier;
}

export function createContainer(
  config: ServerConfig,
  overrides: ContainerOverrides = {},
): Container {
  const log = overrides.log ?? createLogger('app');

  // Persistence wiring, chosen once from configuration.
  let postgresCreated = false;
  const postgres = lazy<PostgresDb>(() => {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is not configured');
    postgresCreated = true;
    return createPostgresDb(config.databaseUrl);
  });
  const memoryStore = lazy(() => new MemoryStore());

  const todoRepository = lazy<TodoRepository>(() =>
    config.dbDriver === 'postgres'
      ? createPostgresTodoRepository(postgres())
      : createMemoryTodoRepository(memoryStore()),
  );
  const auditLogRepository = lazy<AuditLogRepository>(() =>
    config.dbDriver === 'postgres'
      ? createPostgresAuditLogRepository(postgres())
      : createMemoryAuditLogRepository(memoryStore()),
  );
  const versionPolicyRepository = lazy<VersionPolicyRepository>(() =>
    config.dbDriver === 'postgres'
      ? createPostgresVersionPolicyRepository(postgres())
      : createMemoryVersionPolicyRepository(memoryStore()),
  );
  const appConfigRepository = lazy<AppConfigRepository>(() =>
    config.dbDriver === 'postgres'
      ? createPostgresAppConfigRepository(postgres())
      : createMemoryAppConfigRepository(memoryStore()),
  );
  const pushTokenRepository = lazy<PushTokenRepository>(() =>
    config.dbDriver === 'postgres'
      ? createPostgresPushTokenRepository(postgres())
      : createMemoryPushTokenRepository(memoryStore()),
  );
  const unitOfWork = lazy<UnitOfWork>(() =>
    config.dbDriver === 'postgres'
      ? createPostgresUnitOfWork(postgres())
      : createMemoryUnitOfWork(memoryStore()),
  );

  const pubsub = lazy<PubSub>(() => overrides.pubsub ?? createPubSub(config));
  const pushSender = lazy<PushSender>(() => overrides.pushSender ?? createPushSender(config, log));

  const todoService = lazy(
    () =>
      new TodoService({
        todos: todoRepository(),
        auditLogs: auditLogRepository(),
        uow: unitOfWork(),
        events: pubsub(),
      }),
  );
  const versionPolicyService = lazy(
    () =>
      new VersionPolicyService({
        policies: versionPolicyRepository(),
        auditLogs: auditLogRepository(),
        uow: unitOfWork(),
        events: pubsub(),
        cacheTtlMs: overrides.versionPolicyCacheTtlMs,
      }),
  );
  const appConfigService = lazy(
    () =>
      new AppConfigService({
        config: appConfigRepository(),
        auditLogs: auditLogRepository(),
        uow: unitOfWork(),
        events: pubsub(),
      }),
  );
  const pushTokenService = lazy(
    () => new PushTokenService({ tokens: pushTokenRepository(), sender: pushSender() }),
  );
  const voiceService = lazy(() => new VoiceService({ todos: todoService() }));
  const voiceTokenVerifier = lazy<VoiceTokenVerifier>(
    () =>
      overrides.voiceTokenVerifier ??
      // The single shared secret grants every catalog scope. A real verifier
      // returns the scopes actually linked to that user.
      createStaticVoiceTokenVerifier(config.voiceToken, VOICE_SCOPES),
  );

  return {
    config,
    log,
    todoService,
    versionPolicyService,
    appConfigService,
    pushTokenService,
    voiceService,
    voiceTokenVerifier,
    pubsub,
    async dbPing() {
      if (config.dbDriver === 'memory') return true;
      return postgres().ping();
    },
    async dispose() {
      await pubsub().close();
      if (postgresCreated) await postgres().close();
    },
  };
}
