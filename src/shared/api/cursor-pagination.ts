/**
 * Cursor (keyset) pagination — the SECOND pagination mode of every list
 * endpoint, added for the mobile app.
 *
 * The browser client pages through numbered pages (`@shared/api/pagination`,
 * `Page<T>`); phone lists are infinite-scroll, where page/offset silently
 * skips or repeats rows under concurrent inserts. Both modes are served by
 * the same endpoint — a request carrying `limit`/`cursor` gets the cursor
 * envelope, anything else keeps the page envelope:
 *
 *   GET /api/things?limit=20                — first page
 *      &cursor=<opaque>                     — next page (from `nextCursor`)
 *      &sortBy=<field>&sortOrder=asc|desc   — whitelisted per endpoint
 *      &<filterField>=<value>               — endpoint-specific flat filters
 *
 * responding with the `CursorPage<T>` envelope below. `nextCursor` is `null`
 * on the last page; the value is OPAQUE to clients — they must echo it back
 * verbatim, never parse or construct one. This plugs directly into TanStack
 * Query's `useInfiniteQuery` (`getNextPageParam: (page) => page.nextCursor`).
 *
 * Version-skew rule: the envelope fields and cursor opacity are a wire
 * contract with shipped app binaries — never remove or repurpose them.
 */
import { decodeBase64Url, encodeBase64Url } from './base64url';
import type { SORT_ORDERS } from './pagination';

export const CURSOR_PAGINATION = {
  defaultLimit: 20,
  maxLimit: 100,
} as const;

/** @public — part of the cursor wire contract. */
export type SortOrder = (typeof SORT_ORDERS)[number];

/** Response envelope for every list endpoint. */
export interface CursorPage<T> {
  items: T[];
  /** Opaque cursor for the next page, or `null` when this is the last page. */
  nextCursor: string | null;
}

/**
 * What a cursor encodes: the sort-key value and the row id of the last item
 * of the previous page (keyset pagination needs both — the id breaks ties).
 * The sort parameters are baked in so a cursor cannot be replayed against a
 * different ordering (which would silently skip or repeat rows).
 */
export interface CursorPayload {
  /** Serialized sort-key value of the last row (e.g. ISO timestamp or title). */
  readonly v: string;
  /** Row id of the last row — the unique tiebreaker. */
  readonly id: string;
  readonly sortBy: string;
  readonly sortOrder: SortOrder;
}

export function encodeCursor(payload: CursorPayload): string {
  return encodeBase64Url(JSON.stringify(payload));
}

/** Returns `null` for malformed/foreign cursors (mapped to 400 at the route layer). */
export function decodeCursor(cursor: string): CursorPayload | null {
  const json = decodeBase64Url(cursor);
  if (json === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.v !== 'string' ||
    typeof record.id !== 'string' ||
    typeof record.sortBy !== 'string' ||
    (record.sortOrder !== 'asc' && record.sortOrder !== 'desc')
  ) {
    return null;
  }
  return { v: record.v, id: record.id, sortBy: record.sortBy, sortOrder: record.sortOrder };
}

/**
 * Builds the `CursorPage<T>` envelope from `limit + 1` fetched rows: the
 * extra row (if present) proves there is a next page and is trimmed off.
 */
export function buildCursorPage<T>(
  rows: T[],
  limit: number,
  makeCursor: (lastItem: T) => CursorPayload,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last !== undefined ? encodeCursor(makeCursor(last)) : null,
  };
}

/**
 * Does this query ask for the cursor envelope? `limit`/`cursor` are the
 * cursor-mode params; without them a list endpoint answers in page mode
 * (the browser client's contract stays untouched).
 */
export function isCursorQuery(params: URLSearchParams): boolean {
  return params.has('limit') || params.has('cursor');
}
