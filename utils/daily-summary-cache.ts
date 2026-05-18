import AsyncStorage from '@react-native-async-storage/async-storage'

import type { DailySummary } from '@/context/summary-context'
import { apiFetch } from '@/utils/api'
import type { InsightTargets } from '@/utils/insights-aggregator'
import { getLocalDateString } from '@/utils/date'
import { invalidateDay } from '@/utils/insights-cache'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailySummaryBundle {
  daily: DailySummary
  /** Raw API row — keeps steps/sleep fields for insights scoring. */
  raw: Record<string, unknown>
  targets?: InsightTargets
  computed_at: string
}

interface CacheEntry {
  data: DailySummaryBundle
  expiresAt: number
}

// ── Storage ────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v1'
const mem = new Map<string, CacheEntry>()

export const TTL_SUMMARY_CURRENT_DAY = 15 * 60 * 1000
export const TTL_SUMMARY_PAST_DAY     = 24 * 60 * 60 * 1000
export const TTL_FOREGROUND_SKIP_MS    = 15 * 60 * 1000

export function buildSummaryCacheKey(userId: string, date: string): string {
  return `daily-summary:${CACHE_VERSION}:${userId}:${date}`
}

function ttlForDate(date: string): number {
  return date === getLocalDateString() ? TTL_SUMMARY_CURRENT_DAY : TTL_SUMMARY_PAST_DAY
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback
}

function parseDaily(row: Record<string, unknown>): DailySummary {
  return {
    date:                String(row.date ?? ''),
    calorie_budget:      num(row.calorie_budget),
    calories_consumed:   num(row.calories_consumed),
    calories_burned:     num(row.calories_burned),
    net_calories:        num(row.net_calories),
    delta:               num(row.delta),
    protein_consumed:    num(row.protein_consumed),
    carbs_consumed:      num(row.carbs_consumed),
    fat_consumed:        num(row.fat_consumed),
    water_glasses:       num(row.water_glasses),
    calorie_burn_source: typeof row.calorie_burn_source === 'string'
      ? (row.calorie_burn_source as DailySummary['calorie_burn_source'])
      : null,
  }
}

function bundleFromApiBody(body: Record<string, unknown>): DailySummaryBundle | null {
  if (!body.summary || typeof body.summary !== 'object') return null
  const summary = body.summary as Record<string, unknown>
  const targets = body.targets as InsightTargets | undefined
  return {
    daily: parseDaily(summary),
    raw: summary,
    targets: targets && typeof targets === 'object' ? targets : undefined,
    computed_at: typeof body.computed_at === 'string'
      ? body.computed_at
      : new Date().toISOString(),
  }
}

// ── Read / write ───────────────────────────────────────────────────────────

export async function getCachedSummary(
  key: string,
): Promise<{ data: DailySummaryBundle; isStale: boolean } | null> {
  const entry = mem.get(key) as CacheEntry | undefined
  if (entry) {
    return { data: entry.data, isStale: entry.expiresAt <= Date.now() }
  }

  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    mem.set(key, parsed)
    return { data: parsed.data, isStale: parsed.expiresAt <= Date.now() }
  } catch {
    return null
  }
}

export async function setCachedSummary(
  key: string,
  data: DailySummaryBundle,
  ttlMs: number,
): Promise<void> {
  const entry: CacheEntry = { data, expiresAt: Date.now() + ttlMs }
  mem.set(key, entry)
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry))
  } catch { /* storage unavailable */ }
}

export async function invalidateSummaryCache(key: string): Promise<void> {
  mem.delete(key)
  try {
    await AsyncStorage.removeItem(key)
  } catch { /* storage unavailable */ }
}

/** Drop unified summary + insights day cache for one date. */
export async function invalidateUserDayCaches(userId: string, date: string): Promise<void> {
  await Promise.all([
    invalidateSummaryCache(buildSummaryCacheKey(userId, date)),
    invalidateDay(userId, date),
  ])
}

export async function invalidateUserTodayCaches(userId: string): Promise<void> {
  await invalidateUserDayCaches(userId, getLocalDateString())
}

// ── Network fetch (single entry point) ───────────────────────────────────────

export async function fetchDailySummaryBundle(
  userId: string,
  date: string,
  options?: { force?: boolean },
): Promise<DailySummaryBundle | null> {
  const key = buildSummaryCacheKey(userId, date)
  const ttl = ttlForDate(date)

  if (!options?.force) {
    const cached = await getCachedSummary(key)
    if (cached && !cached.isStale) return cached.data
  }

  const { ok, body } = await apiFetch(`/summary/daily/${date}`)
  if (!ok) return null

  const bundle = bundleFromApiBody(body as Record<string, unknown>)
  if (!bundle) return null

  await setCachedSummary(key, bundle, ttl)
  return bundle
}
