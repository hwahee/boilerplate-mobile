/**
 * Persistence contracts.
 *
 * Services depend only on these interfaces; the concrete driver (Postgres via
 * Bun's built-in SQL client, or the in-memory implementation used by tests
 * and DB-less local hacking) is chosen by the container from configuration.
 * Swapping Postgres for another database means writing one new implementation
 * file — no service or route changes.
 */
import type { Platform } from '@shared/domain/platform';
import type { Todo, TodoCursorListQuery, TodoListQuery } from '@shared/domain/todo';
import type { VersionPolicy } from '@shared/domain/version-policy';
import type { UtcIsoString } from '@shared/time';

/**
 * Opaque handle for "the connection this operation must run on".
 * Inside a `UnitOfWork.run` callback it represents the transaction; repository
 * methods called without a session use an implicit non-transactional one.
 */
export interface DbSession {
  readonly __dbSession: true;
}

/**
 * Transaction boundary. Everything executed with the provided session inside
 * `run` commits or rolls back atomically. Keeping this explicit at the
 * *service* layer makes transaction boundaries visible in business code:
 *
 *   await uow.run(async (tx) => {
 *     await todos.insert(todo, tx);
 *     await auditLogs.append(entry, tx);
 *   });
 */
export interface UnitOfWork {
  run<T>(fn: (session: DbSession) => Promise<T>): Promise<T>;
}

/** Decoded keyset cursor: sort-key value + row-id tiebreaker of the last row. */
export interface TodoListCursor {
  readonly v: string;
  readonly id: string;
}

export interface TodoRepository {
  /**
   * Returns one page of todos plus the total row count for the same filter.
   *
   * N+1 note: the page and the total count are produced by ONE query
   * (`count(*) OVER ()` window function) instead of a per-page `SELECT` plus a
   * separate `SELECT count(*)`. Likewise, if todos ever get related rows
   * (tags, assignees, …), fetch them for the whole page with a single
   * `WHERE todo_id IN (…)` query and group in memory — never one query per row.
   */
  list(query: TodoListQuery, session?: DbSession): Promise<{ items: Todo[]; totalItems: number }>;
  /**
   * Keyset ("cursor") pagination for the mobile app's infinite scroll:
   * returns up to `query.limit + 1` rows strictly after `cursor` in the
   * query's ordering — the service trims the extra row into `nextCursor`
   * (see @shared/api/cursor-pagination). Unlike `list` it never counts rows,
   * which is what keeps deep scrolling cheap.
   */
  listByCursor(
    query: TodoCursorListQuery,
    cursor: TodoListCursor | null,
    session?: DbSession,
  ): Promise<Todo[]>;
  findById(id: string, session?: DbSession): Promise<Todo | null>;
  insert(todo: Todo, session?: DbSession): Promise<void>;
  /** Full-row update by `todo.id`. */
  update(todo: Todo, session?: DbSession): Promise<void>;
  /** Returns `false` when no row matched. */
  deleteById(id: string, session?: DbSession): Promise<boolean>;
}

/** Append-only audit trail, written in the same transaction as the change. */
export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  payload?: unknown;
  createdAt: UtcIsoString;
}

export interface AuditLogRepository {
  append(entry: AuditLogEntry, session?: DbSession): Promise<void>;
}

// ── Mobile-app support tables (see migrations/0002_mobile.sql) ───────────────

/** One row per platform — the single source of truth for update policy. */
export interface VersionPolicyRepository {
  findByPlatform(platform: Platform, session?: DbSession): Promise<VersionPolicy | null>;
  upsert(policy: VersionPolicy, session?: DbSession): Promise<void>;
}

/** Snapshot of the whole remote config plus its monotonic revision. */
export interface AppConfigSnapshot {
  revision: number;
  entries: Record<string, unknown>;
}

export interface AppConfigRepository {
  /**
   * N+1 note: ONE query returns every entry; the revision comes from the
   * single-row `app_config_revision` counter.
   */
  getAll(session?: DbSession): Promise<AppConfigSnapshot>;
  /** Upserts one key and bumps the revision atomically; returns the new revision. */
  set(key: string, value: unknown, session?: DbSession): Promise<number>;
}

export interface DevicePushToken {
  /** Provider token (e.g. `ExponentPushToken[…]`) — unique per device install. */
  token: string;
  platform: Platform;
  appVersion: string | null;
  createdAt: UtcIsoString;
  updatedAt: UtcIsoString;
}

export interface PushTokenRepository {
  /** Idempotent: re-registering an existing token refreshes its metadata. */
  upsert(token: DevicePushToken, session?: DbSession): Promise<void>;
  /** Returns `false` when the token was not registered. */
  deleteByToken(token: string, session?: DbSession): Promise<boolean>;
  /** All registered tokens — the fan-out set for broadcast pushes. */
  listAll(session?: DbSession): Promise<DevicePushToken[]>;
}
