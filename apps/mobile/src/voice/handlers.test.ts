/**
 * Voice dispatch logic. The navigator is mocked so this stays a pure unit
 * test — what is under test is the routing decision, not React Navigation.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';

let ready = false;
const navigate = mock((..._args: unknown[]) => undefined);

void mock.module('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: () => ready,
    navigate,
  }),
}));

const { handleVoiceUrl, flushPendingVoiceUrl } = await import('./handlers');

beforeEach(() => {
  ready = true;
  navigate.mockClear();
  // Drop anything a previous test left queued.
  flushPendingVoiceUrl();
  navigate.mockClear();
});

describe('handleVoiceUrl', () => {
  test('routes a search command with its spoken term', () => {
    expect(handleVoiceUrl('mobileboilerplate://voice/todos.search?query=milk')).toBe(true);
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'TodosTab',
      params: { q: 'milk' },
    });
  });

  test('routes a parameter-less command', () => {
    expect(handleVoiceUrl('https://app.example.com/voice/todos.open')).toBe(true);
    expect(navigate).toHaveBeenCalledWith('Main', { screen: 'TodosTab', params: {} });
  });

  test('ignores non-voice deep links so React Navigation can have them', () => {
    expect(handleVoiceUrl('mobileboilerplate://todos')).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  test('swallows an unknown intent id — a new assistant surface may outrun this binary', () => {
    expect(handleVoiceUrl('mobileboilerplate://voice/not.here')).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  test('swallows an api-mode intent that should never have opened the app', () => {
    expect(handleVoiceUrl('mobileboilerplate://voice/todo.create?title=x')).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  test('rejects a command whose required slot is missing', () => {
    expect(handleVoiceUrl('mobileboilerplate://voice/todos.search')).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  test('rejects a blank dictation', () => {
    expect(handleVoiceUrl('mobileboilerplate://voice/todos.search?query=%20%20')).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('cold start', () => {
  test('queues a command that arrives before the navigator, then replays it', () => {
    ready = false;
    expect(handleVoiceUrl('mobileboilerplate://voice/todos.search?query=milk')).toBe(true);
    expect(navigate).not.toHaveBeenCalled();

    ready = true;
    flushPendingVoiceUrl();
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'TodosTab',
      params: { q: 'milk' },
    });
  });

  test('keeps only the newest queued command', () => {
    ready = false;
    handleVoiceUrl('mobileboilerplate://voice/todos.search?query=old');
    handleVoiceUrl('mobileboilerplate://voice/todos.search?query=new');

    ready = true;
    flushPendingVoiceUrl();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'TodosTab',
      params: { q: 'new' },
    });
  });

  test('flushing with nothing queued is a no-op', () => {
    flushPendingVoiceUrl();
    expect(navigate).not.toHaveBeenCalled();
  });
});
