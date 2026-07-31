/**
 * Execution of the `api`-mode voice intents (@shared/voice/catalog).
 *
 * These run WITHOUT the app: a Swift App Intent or a Bixby Capsule endpoint
 * calls the HTTP route, and the assistant speaks the answer. So every handler
 * must return a sentence that makes sense heard once, at speed — the `speech`
 * field is the actual product here; `data` exists for callers that also render
 * something (a Siri snippet view, a Bixby result card).
 *
 * Pure of HTTP concerns, like every other service — the localized translator
 * is passed in, so the same handler serves an English Siri and a Korean Bixby.
 */
import type { MessageKey, MessageParams } from '@shared/i18n';
import type { ApiVoiceIntentId } from '@shared/voice/catalog';

import type { TodoService } from './todo-service';

/** Bound translator for the caller's negotiated locale (see http/context.ts). */
export type Translate = (key: MessageKey, params?: MessageParams) => string;

export interface VoiceResult {
  /** The sentence the assistant reads out. Already localized. */
  readonly speech: string;
  /** Structured echo of what happened, for snippet/card rendering. */
  readonly data: Readonly<Record<string, unknown>>;
}

interface VoiceServiceDeps {
  todos: TodoService;
}

/**
 * One handler per `api` intent. Typed as a total map over
 * {@link ApiVoiceIntentId}, so adding an `api` intent to the catalog is a
 * COMPILE ERROR until its handler exists.
 */
type VoiceHandler = (
  params: Record<string, unknown>,
  t: Translate,
  deps: VoiceServiceDeps,
) => Promise<VoiceResult>;

type VoiceHandlers = Record<ApiVoiceIntentId, VoiceHandler>;

/**
 * How many open todos to count before answering "many". Reading an exact
 * number is only useful while it is small; past this the driver just needs to
 * know there is a pile.
 */
const SUMMARY_COUNT_LIMIT = 50;

const HANDLERS: VoiceHandlers = {
  'todo.create': async (params, t, deps) => {
    const title = String(params.title);
    const todo = await deps.todos.create({ title });
    return {
      speech: t('voice.todo.created', { title }),
      data: { id: todo.id, title: todo.title },
    };
  },

  'todo.summary': async (_params, t, deps) => {
    // Cursor mode with a bounded limit: this answers a spoken question, so it
    // must never turn into a full-table scan on a large account.
    const page = await deps.todos.listByCursor({
      limit: SUMMARY_COUNT_LIMIT,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      status: 'open',
    });
    const count = page.items.length;
    const capped = page.nextCursor !== null;

    if (count === 0) return { speech: t('voice.todo.summary.empty'), data: { count: 0 } };
    if (count === 1 && !capped) {
      return { speech: t('voice.todo.summary.one'), data: { count: 1 } };
    }
    return {
      speech: t('voice.todo.summary.many', { count: capped ? `${String(count)}+` : count }),
      data: { count, capped },
    };
  },
};

export class VoiceService {
  constructor(private readonly deps: VoiceServiceDeps) {}

  /**
   * Runs an intent. `params` must already have been validated against the
   * catalog's validator by the caller (the route does this at the boundary).
   */
  execute(
    id: ApiVoiceIntentId,
    params: Record<string, unknown>,
    t: Translate,
  ): Promise<VoiceResult> {
    return HANDLERS[id](params, t, this.deps);
  }
}
