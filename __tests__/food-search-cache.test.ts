import AsyncStorage from '@react-native-async-storage/async-storage';

// food-search-cache -> resource-cache -> daily-summary-cache -> @/utils/api,
// which pulls in expo-constants / expo-secure-store (native). Stub it so the
// pure cache logic runs under node.
jest.mock('@/utils/api', () => ({
  apiFetch: jest.fn(),
  publicApiFetch: jest.fn(),
}));

import {
  clearFoodSearchCache,
  foodSearchCacheKey,
  normalizeFoodQuery,
  rememberSearchKey,
} from '@/utils/food-search-cache';
import {
  buildResourceKey,
  getResourceCached,
  setResourceCached,
} from '@/utils/resource-cache';

let counter = 0;
function uid(): string {
  counter += 1;
  return `user-food-search-${counter}`;
}

const HOUR = 60 * 60 * 1000;

/** Mirrors what the context stores: a cached page plus its LRU index entry. */
async function cachePage(userId: string, query: string): Promise<string> {
  const key = foodSearchCacheKey(userId, normalizeFoodQuery(query));
  await setResourceCached(key, [{ id: `usda:${query}`, name: query }], HOUR);
  await rememberSearchKey(userId, key);
  return key;
}

async function readIndex(userId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(buildResourceKey('food-search-index', userId));
  return raw ? JSON.parse(raw) : [];
}

describe('normalizeFoodQuery', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeFoodQuery('  Chicken   Breast ')).toBe('chicken breast');
  });

  it('maps queries that differ only by case or spacing onto one key', () => {
    const user = uid();
    expect(foodSearchCacheKey(user, normalizeFoodQuery('Greek  Yogurt')))
      .toBe(foodSearchCacheKey(user, normalizeFoodQuery('greek yogurt')));
  });
});

describe('food search cache', () => {
  it('keeps a cached page retrievable', async () => {
    const user = uid();
    const key = await cachePage(user, 'banana');

    const cached = await getResourceCached<{ id: string }[]>(key);
    expect(cached?.data[0].id).toBe('usda:banana');
  });

  it('evicts the oldest pages once the cap is exceeded', async () => {
    const user = uid();

    // 45 distinct searches against a 40-entry cap.
    const keys: string[] = [];
    for (let i = 0; i < 45; i++) {
      keys.push(await cachePage(user, `food ${i}`));
    }

    // The five oldest are gone from storage entirely...
    for (const evicted of keys.slice(0, 5)) {
      expect(await getResourceCached(evicted)).toBeNull();
    }
    // ...and the most recent survive.
    for (const kept of keys.slice(-5)) {
      expect(await getResourceCached(kept)).not.toBeNull();
    }
  });

  it('treats a repeated search as recently used rather than a new entry', async () => {
    const user = uid();

    const first = await cachePage(user, 'oldest');
    for (let i = 0; i < 39; i++) await cachePage(user, `filler ${i}`);

    // Re-searching refreshes recency; the entry must survive the next eviction.
    await rememberSearchKey(user, first);
    await cachePage(user, 'one more');

    expect(await getResourceCached(first)).not.toBeNull();
  });

  it('handles concurrent writes without losing evictions', async () => {
    const user = uid();

    // Fire 50 searches at once — a read-modify-write race on the index would
    // leave orphaned keys above the cap.
    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        setResourceCached(foodSearchCacheKey(user, `race ${i}`), [{ id: `${i}` }], HOUR)
          .then(() => rememberSearchKey(user, foodSearchCacheKey(user, `race ${i}`))),
      ),
    );

    const index = await readIndex(user);
    expect(index.length).toBeLessThanOrEqual(40);
  });

  it('clears every cached page for a user', async () => {
    const user = uid();
    const a = await cachePage(user, 'apple');
    const b = await cachePage(user, 'pear');

    await clearFoodSearchCache(user);

    expect(await getResourceCached(a)).toBeNull();
    expect(await getResourceCached(b)).toBeNull();
  });
});
