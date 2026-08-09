import AsyncStorage from '@react-native-async-storage/async-storage'

import { buildResourceKey, invalidateKeys } from '@/utils/resource-cache'

/**
 * Bounded client-side cache for food search result pages.
 *
 * Search pages are cached per normalised query so repeating a search — or
 * re-opening the screen and typing the same thing — is instant and costs no
 * request. Foods barely change, so a long TTL is safe.
 *
 * The reason this needs its own module rather than a bare `fetchWithResourceCache`
 * call: every distinct query writes a new AsyncStorage key that nothing would
 * ever remove. At ~10KB per page, a habitual logger would accumulate tens of MB
 * over a year and blow past Android's 6MB AsyncStorage ceiling — which fails
 * writes for *every* cache in the app, not just this one. An LRU keeps the
 * footprint flat.
 */

/** ~40 pages ≈ 400KB — comfortably inside the budget, and far more than the
 *  handful of foods a user actually re-searches. */
const MAX_CACHED_SEARCHES = 40

/** Matches the backend's `normalizeFoodQuery`, so both sides key alike. */
export function normalizeFoodQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function foodSearchCacheKey(userId: string, normalizedQuery: string): string {
  return buildResourceKey('food-search', userId, normalizedQuery)
}

function indexKey(userId: string): string {
  return buildResourceKey('food-search-index', userId)
}

/**
 * Serialises index updates. Searches complete concurrently (a debounced query
 * can land while a previous one is still writing), and a read-modify-write race
 * on the index would lose evictions and leak keys.
 */
let indexQueue: Promise<unknown> = Promise.resolve()

async function readIndex(userId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(indexKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

/**
 * Records a cached search page as most-recently-used and evicts the oldest once
 * the cap is exceeded. Best-effort: a failure here costs cache hygiene, never
 * correctness, so it must not surface to the caller.
 */
export function rememberSearchKey(userId: string, key: string): Promise<void> {
  const run = async () => {
    try {
      const index = await readIndex(userId)
      const next = [...index.filter((k) => k !== key), key]

      const overflow = next.length - MAX_CACHED_SEARCHES
      if (overflow > 0) {
        const evicted = next.splice(0, overflow)
        await invalidateKeys(evicted)
      }

      await AsyncStorage.setItem(indexKey(userId), JSON.stringify(next))
    } catch {
      /* storage unavailable — the cache simply stays as it was */
    }
  }

  indexQueue = indexQueue.then(run, run)
  return indexQueue as Promise<void>
}

/** Drops every cached search page for a user. */
export async function clearFoodSearchCache(userId: string): Promise<void> {
  const index = await readIndex(userId)
  await invalidateKeys([...index, indexKey(userId)])
}
