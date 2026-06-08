import AsyncStorage from '@react-native-async-storage/async-storage'

import { getLocalDateString } from '@/utils/date'
import {
  TTL_COLD_START_MS,
  TTL_SUMMARY_PAST_DAY,
} from '@/utils/daily-summary-cache'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const mem = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

// ── Observability ───────────────────────────────────────────────────────────
// Flip on (e.g. from a dev menu or temporarily in code) to trace every cache
// decision and confirm reloads are served from cache, not the network.
let cacheDebug = false
export function setResourceCacheDebug(on: boolean): void {
  cacheDebug = on
}
type CacheEvent = 'hit' | 'stale-serve' | 'stale-network' | 'miss-network' | 'store'
function logCache(event: CacheEvent, key: string): void {
  if (cacheDebug) console.log(`[resource-cache] ${event.padEnd(13)} ${key}`)
}

// v2: weekly summary resource cache now stores the raw API body (not the trimmed WeeklySummary shape).
const CACHE_VERSION = 'v2'

export function buildResourceKey(
  kind: string,
  userId: string,
  ...parts: string[]
): string {
  return `resource:${CACHE_VERSION}:${kind}:${userId}:${parts.join(':')}`
}

export function ttlForDate(
  date: string,
  todayTtl = TTL_COLD_START_MS,
  pastTtl = TTL_SUMMARY_PAST_DAY,
): number {
  return date === getLocalDateString() ? todayTtl : pastTtl
}

export async function getResourceCached<T>(
  key: string,
): Promise<{ data: T; isStale: boolean } | null> {
  const entry = mem.get(key) as CacheEntry<T> | undefined
  if (entry) {
    return { data: entry.data, isStale: entry.expiresAt <= Date.now() }
  }

  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry<T>
    mem.set(key, parsed)
    return { data: parsed.data, isStale: parsed.expiresAt <= Date.now() }
  } catch {
    return null
  }
}

export async function setResourceCached<T>(
  key: string,
  data: T,
  ttlMs: number,
): Promise<void> {
  const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs }
  mem.set(key, entry)
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry))
  } catch { /* storage unavailable */ }
}

export async function invalidateResourceCache(key: string): Promise<void> {
  mem.delete(key)
  inflight.delete(key)
  try {
    await AsyncStorage.removeItem(key)
  } catch { /* storage unavailable */ }
}

export async function invalidateKeys(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => invalidateResourceCache(key)))
}

/** Remove all resource-cache keys whose storage key starts with `prefix`. */
export async function invalidateByPrefix(prefix: string): Promise<void> {
  for (const key of [...mem.keys()]) {
    if (key.startsWith(prefix)) {
      mem.delete(key)
      inflight.delete(key)
    }
  }

  try {
    const allKeys = await AsyncStorage.getAllKeys()
    const matching = allKeys.filter((k) => k.startsWith(prefix))
    if (matching.length > 0) {
      await AsyncStorage.multiRemove(matching)
    }
  } catch { /* storage unavailable */ }
}

export interface FetchWithResourceCacheOptions {
  force?: boolean
  /** Return stale data immediately and refresh in the background. */
  allowStale?: boolean
}

/**
 * Cache-first fetch: returns fresh cache when valid, otherwise runs fetcher once
 * (deduped per key) and stores the result.
 */
export async function fetchWithResourceCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T | null>,
  options?: FetchWithResourceCacheOptions,
): Promise<T | null> {
  const force = options?.force ?? false
  const allowStale = options?.allowStale ?? false

  if (!force) {
    const cached = await getResourceCached<T>(key)
    if (cached) {
      if (!cached.isStale) {
        logCache('hit', key)
        return cached.data
      }

      if (allowStale) {
        logCache('stale-serve', key)
        const pending = inflight.get(key) as Promise<T | null> | undefined
        if (!pending) {
          const refresh = fetcher()
            .then(async (data) => {
              if (data !== null) await setResourceCached(key, data, ttlMs)
              return data
            })
            .finally(() => {
              if (inflight.get(key) === refresh) inflight.delete(key)
            })
          inflight.set(key, refresh)
        }
        return cached.data
      }
      logCache('stale-network', key)
    } else {
      logCache('miss-network', key)
    }

    const pending = inflight.get(key) as Promise<T | null> | undefined
    if (pending) return pending
  } else {
    inflight.delete(key)
  }

  const request = fetcher()
    .then(async (data) => {
      if (data !== null) {
        await setResourceCached(key, data, ttlMs)
        logCache('store', key)
      }
      return data
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key)
    })

  inflight.set(key, request)
  return request
}

/** Alias for fetchWithResourceCache. */
export const fetchWithCache = fetchWithResourceCache
