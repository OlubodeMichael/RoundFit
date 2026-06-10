import AsyncStorage from '@react-native-async-storage/async-storage';

// resource-cache transitively imports daily-summary-cache -> @/utils/api, which
// pulls in expo-secure-store / expo-constants (native). Stub it so the pure
// cache engine can run under node. Factory form avoids loading the real module.
jest.mock('@/utils/api', () => ({
  apiFetch: jest.fn(),
  publicApiFetch: jest.fn(),
}));

import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  invalidateByPrefix,
  invalidateResourceCache,
  setResourceCached,
  ttlForDate,
} from '@/utils/resource-cache';
import { getLocalDateString } from '@/utils/date';

const FRESH = 1_000_000; // ttl far in the future
const STALE = -1_000; // ttl already elapsed -> entry is immediately stale

let counter = 0;
/** Unique key per test so the module-level mem/inflight maps don't collide. */
function k(): string {
  counter += 1;
  return `resource:test:${counter}:${Math.random().toString(36).slice(2)}`;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('buildResourceKey', () => {
  it('namespaces by version, kind, user, and parts', () => {
    expect(buildResourceKey('food-logs', 'user-1', '2026-06-09')).toBe(
      'resource:v2:food-logs:user-1:2026-06-09',
    );
  });
});

describe('ttlForDate', () => {
  it('returns the today TTL for the local date and the past TTL otherwise', () => {
    expect(ttlForDate(getLocalDateString(), 111, 222)).toBe(111);
    expect(ttlForDate('2000-01-01', 111, 222)).toBe(222);
  });
});

describe('get/set round-trip', () => {
  it('marks a future-TTL entry fresh and a past-TTL entry stale', async () => {
    const key = k();
    await setResourceCached(key, { v: 1 }, FRESH);
    expect(await getResourceCached(key)).toEqual({ data: { v: 1 }, isStale: false });

    await setResourceCached(key, { v: 2 }, STALE);
    expect(await getResourceCached(key)).toEqual({ data: { v: 2 }, isStale: true });
  });

  it('reads an entry written only to AsyncStorage (cold mem)', async () => {
    const key = k();
    // Simulate a process restart: entry on disk, nothing in the mem map.
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ data: { hydrated: true }, expiresAt: Date.now() + FRESH }),
    );
    const result = await getResourceCached<{ hydrated: boolean }>(key);
    expect(result).toEqual({ data: { hydrated: true }, isStale: false });
  });

  it('returns null when the key is absent', async () => {
    expect(await getResourceCached(k())).toBeNull();
  });
});

describe('fetchWithResourceCache', () => {
  it('calls the fetcher on a cold miss and stores the result', async () => {
    const key = k();
    const fetcher = jest.fn().mockResolvedValue({ n: 1 });
    const result = await fetchWithResourceCache(key, FRESH, fetcher);
    expect(result).toEqual({ n: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    // Stored for next time.
    expect(await getResourceCached(key)).toEqual({ data: { n: 1 }, isStale: false });
  });

  it('serves a fresh cache hit without calling the fetcher', async () => {
    const key = k();
    await setResourceCached(key, { cached: true }, FRESH);
    const fetcher = jest.fn().mockResolvedValue({ cached: false });
    const result = await fetchWithResourceCache(key, FRESH, fetcher);
    expect(result).toEqual({ cached: true });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refetches synchronously when stale and allowStale is false', async () => {
    const key = k();
    await setResourceCached(key, { old: true }, STALE);
    const fetcher = jest.fn().mockResolvedValue({ old: false });
    const result = await fetchWithResourceCache(key, FRESH, fetcher);
    expect(result).toEqual({ old: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns stale data immediately and revalidates in the background when allowStale', async () => {
    const key = k();
    await setResourceCached(key, { v: 'stale' }, STALE);
    let resolveFetch!: (v: { v: string }) => void;
    const fetcher = jest.fn(
      () => new Promise<{ v: string }>((res) => { resolveFetch = res; }),
    );

    const immediate = await fetchWithResourceCache(key, FRESH, fetcher, { allowStale: true });
    expect(immediate).toEqual({ v: 'stale' }); // served stale, did not wait
    expect(fetcher).toHaveBeenCalledTimes(1); // background refresh kicked off

    resolveFetch({ v: 'fresh' });
    await new Promise((r) => setTimeout(r, 0)); // let the background write settle
    expect(await getResourceCached(key)).toEqual({ data: { v: 'fresh' }, isStale: false });
  });

  it('dedupes concurrent fetches for the same key (single inflight)', async () => {
    const key = k();
    let resolveFetch!: (v: { n: number }) => void;
    const fetcher = jest.fn(
      () => new Promise<{ n: number }>((res) => { resolveFetch = res; }),
    );

    const a = fetchWithResourceCache(key, FRESH, fetcher);
    const b = fetchWithResourceCache(key, FRESH, fetcher);
    // Cache lookup is async; let both calls reach the (shared) inflight fetcher.
    await new Promise((r) => setTimeout(r, 0));
    resolveFetch({ n: 42 });

    expect(await a).toEqual({ n: 42 });
    expect(await b).toEqual({ n: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('bypasses a fresh cache when force is set', async () => {
    const key = k();
    await setResourceCached(key, { forced: false }, FRESH);
    const fetcher = jest.fn().mockResolvedValue({ forced: true });
    const result = await fetchWithResourceCache(key, FRESH, fetcher, { force: true });
    expect(result).toEqual({ forced: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not cache a null fetcher result', async () => {
    const key = k();
    const fetcher = jest.fn().mockResolvedValue(null);
    expect(await fetchWithResourceCache(key, FRESH, fetcher)).toBeNull();
    expect(await getResourceCached(key)).toBeNull();
  });
});

describe('invalidation', () => {
  it('invalidateResourceCache drops the entry from mem and disk', async () => {
    const key = k();
    await setResourceCached(key, { v: 1 }, FRESH);
    await invalidateResourceCache(key);
    expect(await getResourceCached(key)).toBeNull();
    expect(await AsyncStorage.getItem(key)).toBeNull();
  });

  it('invalidateByPrefix clears matching keys and leaves others intact', async () => {
    const keep = 'resource:v2:other:user-1:x';
    await setResourceCached('resource:v2:food-logs:user-1:a', { v: 1 }, FRESH);
    await setResourceCached('resource:v2:food-logs:user-1:b', { v: 2 }, FRESH);
    await setResourceCached(keep, { v: 3 }, FRESH);

    await invalidateByPrefix('resource:v2:food-logs:user-1');

    expect(await getResourceCached('resource:v2:food-logs:user-1:a')).toBeNull();
    expect(await getResourceCached('resource:v2:food-logs:user-1:b')).toBeNull();
    expect(await getResourceCached(keep)).toEqual({ data: { v: 3 }, isStale: false });
  });
});
