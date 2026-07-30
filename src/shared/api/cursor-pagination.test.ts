import { describe, expect, test } from 'bun:test';

import { decodeBase64Url, encodeBase64Url } from './base64url';
import {
  buildCursorPage,
  decodeCursor,
  encodeCursor,
  isCursorQuery,
  type CursorPayload,
} from './cursor-pagination';

describe('base64url', () => {
  test.each(['', 'hello', '{"v":"2026-01-01T00:00:00.000Z","id":"x"}', '한글 · émoji 🚀', 'a'])(
    'round-trips %j',
    (input) => {
      expect(decodeBase64Url(encodeBase64Url(input))).toBe(input);
    },
  );

  test('output is URL-safe (no +, /, =)', () => {
    const encoded = encodeBase64Url('??>>~~\xff subjects');
    expect(encoded).not.toMatch(/[+/=]/);
  });

  test('rejects malformed input instead of throwing', () => {
    expect(decodeBase64Url('not base64url!!')).toBeNull();
    expect(decodeBase64Url('a')).toBeNull(); // impossible length
  });
});

describe('cursor encode/decode', () => {
  const payload: CursorPayload = {
    v: '2026-07-01T00:00:00.000Z',
    id: '00000000-0000-4000-8000-000000000001',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  test('round-trips a payload', () => {
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  test('rejects garbage, non-JSON and wrong-shape cursors', () => {
    expect(decodeCursor('!!!not-a-cursor!!!')).toBeNull();
    expect(decodeCursor(encodeBase64Url('plain text'))).toBeNull();
    expect(decodeCursor(encodeBase64Url('{"v":1,"id":2}'))).toBeNull();
    expect(
      decodeCursor(encodeBase64Url('{"v":"x","id":"y","sortBy":"z","sortOrder":"up"}')),
    ).toBeNull();
  });
});

describe('buildCursorPage', () => {
  const makeCursor = (item: { id: string; createdAt: string }): CursorPayload => ({
    v: item.createdAt,
    id: item.id,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const row = (id: string) => ({ id, createdAt: `2026-07-0${id}T00:00:00.000Z` });

  test('with limit+1 rows: trims the extra row and emits a cursor for the last kept row', () => {
    const page = buildCursorPage([row('1'), row('2'), row('3')], 2, makeCursor);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor!)).toMatchObject({ id: '2' });
  });

  test('with <= limit rows: last page, no cursor', () => {
    expect(buildCursorPage([row('1')], 2, makeCursor).nextCursor).toBeNull();
    expect(buildCursorPage([], 2, makeCursor)).toEqual({ items: [], nextCursor: null });
  });
});

describe('isCursorQuery', () => {
  test('limit or cursor selects the cursor envelope', () => {
    expect(isCursorQuery(new URLSearchParams('limit=20'))).toBe(true);
    expect(isCursorQuery(new URLSearchParams('cursor=abc'))).toBe(true);
  });

  test('the browser client’s page query keeps the page envelope', () => {
    expect(isCursorQuery(new URLSearchParams('page=2&pageSize=20&status=open'))).toBe(false);
    expect(isCursorQuery(new URLSearchParams(''))).toBe(false);
  });
});
