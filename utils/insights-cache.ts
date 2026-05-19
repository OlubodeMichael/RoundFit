import AsyncStorage from '@react-native-async-storage/async-storage'

// ── In-memory layer (same-session speed) ──────────────────────────────────

interface CacheEntry<T> {
  data:      T
  expiresAt: number
}

const mem = new Map<string, CacheEntry<unknown>>()

// ── Key builders ───────────────────────────────────────────────────────────

// v2: bumped after backend summary queries were fixed to use `date` column
// instead of `recorded_at` — old v1 entries had null steps/sleep baked in.
const CACHE_VERSION = 'v2'

export function buildWeekKey(userId: string, weekStart: string): string {
  return `insights:${CACHE_VERSION}:week:${userId}:${weekStart}`
}

export function buildDayKey(userId: string, date: string): string {
  return `insights:${CACHE_VERSION}:day:${userId}:${date}`
}

// ── TTL constants ──────────────────────────────────────────────────────────

export const TTL_CURRENT_WEEK = 2 * 60 * 60 * 1000  // 2 h — mutations invalidate
export const TTL_PAST_WEEK    = 24 * 60 * 60 * 1000 // 24 h
export const TTL_CURRENT_DAY  = 2 * 60 * 60 * 1000  // 2 h — mutations invalidate
export const TTL_PAST_DAY     = 24 * 60 * 60 * 1000 // 24 h

// ── Read ───────────────────────────────────────────────────────────────────

export async function getCached<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
  // 1. In-memory
  const entry = mem.get(key) as CacheEntry<T> | undefined
  if (entry) {
    return { data: entry.data, isStale: entry.expiresAt <= Date.now() }
  }

  // 2. AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry<T>
    // Restore to memory for subsequent reads
    mem.set(key, parsed)
    return { data: parsed.data, isStale: parsed.expiresAt <= Date.now() }
  } catch {
    return null
  }
}

// ── Write ──────────────────────────────────────────────────────────────────

export async function setCached<T>(key: string, data: T, ttlMs: number): Promise<void> {
  const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs }
  mem.set(key, entry)
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry))
  } catch { /* storage unavailable */ }
}

// ── Invalidate ─────────────────────────────────────────────────────────────

export async function invalidate(key: string): Promise<void> {
  mem.delete(key)
  try {
    await AsyncStorage.removeItem(key)
  } catch { /* storage unavailable */ }
}

export async function invalidateWeek(userId: string, weekStart: string): Promise<void> {
  await invalidate(buildWeekKey(userId, weekStart))
}

export async function invalidateDay(userId: string, date: string): Promise<void> {
  await invalidate(buildDayKey(userId, date))
}
