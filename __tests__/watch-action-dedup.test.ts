import type { WatchAction } from '@/types/watch';
import {
  appendProcessedId,
  shouldApplyWatchAction,
  watchActionLocalDay,
} from '@/utils/watch-action-dedup';

function water(id: string, ts: string): WatchAction {
  return { id, ts, type: 'logWater', amountMl: 250 };
}

describe('shouldApplyWatchAction', () => {
  const today = '2026-07-07';

  it('applies a fresh action taken today', () => {
    expect(shouldApplyWatchAction(water('a', '2026-07-07T10:00:00Z'), [], today)).toBe(true);
  });

  it('rejects an already-processed id (replay after reconnect)', () => {
    expect(
      shouldApplyWatchAction(water('a', '2026-07-07T10:00:00Z'), ['a'], today),
    ).toBe(false);
  });

  it('rejects a stale action queued from a previous day', () => {
    expect(
      shouldApplyWatchAction(water('b', '2026-07-06T23:50:00Z'), [], today),
    ).toBe(false);
  });
});

describe('watchActionLocalDay', () => {
  it('returns empty string for an unparseable timestamp', () => {
    expect(watchActionLocalDay(water('a', 'not-a-date'))).toBe('');
  });
});

describe('appendProcessedId', () => {
  it('appends and dedups, keeping most-recent-last', () => {
    expect(appendProcessedId(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(appendProcessedId(['a', 'b'], 'a')).toEqual(['b', 'a']);
  });

  it('caps the window to the max, dropping the oldest', () => {
    expect(appendProcessedId(['a', 'b', 'c'], 'd', 3)).toEqual(['b', 'c', 'd']);
  });
});
