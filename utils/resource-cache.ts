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

const CACHE_VERSION = 'v1'

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

/**
 * Cache-first fetch: returns fresh cache when valid, otherwise runs fetcher once
 * (deduped per key) and stores the result.
 */
export async function fetchWithResourceCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T | null>,
  options?: { force?: boolean },
): Promise<T | null> {
  if (!options?.force) {
    const cached = await getResourceCached<T>(key)
    if (cached && !cached.isStale) return cached.data

    const pending = inflight.get(key) as Promise<T | null> | undefined
    if (pending) return pending
  } else {
    inflight.delete(key)
  }

  const request = fetcher()
    .then(async (data) => {
      if (data !== null) await setResourceCached(key, data, ttlMs)
      return data
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key)
    })

  inflight.set(key, request)
  return request
}
