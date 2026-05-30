import {
  buildResourceKey,
  getResourceCached,
  invalidateResourceCache,
  setResourceCached,
} from '@/utils/resource-cache'

// v4: weekly days aligned to Mon–Sun grid with normalized YYYY-MM-DD keys.
const CACHE_VERSION = 'v4'

export function buildWeekKey(userId: string, weekStart: string): string {
  return `insights:${CACHE_VERSION}:week:${userId}:${weekStart}`
}

export function buildDayKey(userId: string, date: string): string {
  return `insights:${CACHE_VERSION}:day:${userId}:${date}`
}

export const TTL_CURRENT_WEEK = 2 * 60 * 60 * 1000
export const TTL_PAST_WEEK    = 24 * 60 * 60 * 1000
export const TTL_CURRENT_DAY  = 2 * 60 * 60 * 1000
export const TTL_PAST_DAY     = 24 * 60 * 60 * 1000

export async function getCached<T>(
  key: string,
): Promise<{ data: T; isStale: boolean } | null> {
  return getResourceCached<T>(key)
}

export async function setCached<T>(key: string, data: T, ttlMs: number): Promise<void> {
  await setResourceCached(key, data, ttlMs)
}

export async function invalidate(key: string): Promise<void> {
  await invalidateResourceCache(key)
}

export async function invalidateWeek(userId: string, weekStart: string): Promise<void> {
  await Promise.all([
    invalidate(buildWeekKey(userId, weekStart)),
    invalidateResourceCache(buildResourceKey('summary-weekly', userId, weekStart)),
  ])
}

export async function invalidateDay(userId: string, date: string): Promise<void> {
  await invalidate(buildDayKey(userId, date))
}
