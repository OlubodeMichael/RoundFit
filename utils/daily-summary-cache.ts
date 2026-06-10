import type { DailySummary } from '@/context/summary-context'
import { apiFetch } from '@/utils/api'
import type { InsightTargets } from '@/utils/insights-aggregator'
import { getLocalDateString } from '@/utils/date'
import { buildWeekKey, invalidate as invalidateInsightsKey, invalidateDay } from '@/utils/insights-cache'
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  invalidateResourceCache,
  setResourceCached,
} from '@/utils/resource-cache'
import { getWeekStart } from '@/utils/insights-aggregator'

// ── Types ────────────────────────────────────────────────────────────────────

export interface DailySummaryBundle {
  daily: DailySummary
  /** Raw API row — keeps steps/sleep fields for insights scoring. */
  raw: Record<string, unknown>
  targets?: InsightTargets
  computed_at: string
}

// ── Storage ────────────────────────────────────────────────────────────────
//
// This module is a *domain adapter* over the single cache engine in
// `resource-cache`. It owns the daily-summary key shape, TTL policy, API
// fetch, and body→bundle parsing; the engine owns the mem/AsyncStorage/inflight
// mechanics. Keeping one engine means one invalidation path (e.g. logout's
// `invalidateByPrefix('daily-summary:')` now clears these entries from memory
// too, not just disk).

const CACHE_VERSION = 'v1'

export const TTL_COLD_START_MS         = 2 * 60 * 60 * 1000  // today data: fresh for 2 h (mutations invalidate)
export const TTL_SUMMARY_CURRENT_DAY  = TTL_COLD_START_MS
export const TTL_SUMMARY_PAST_DAY     = 24 * 60 * 60 * 1000
export const TTL_FOREGROUND_SKIP_MS   = 15 * 60 * 1000        // AppState foreground-return threshold only

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

// ── Read / write (delegated to the resource-cache engine) ────────────────────

export function getCachedSummary(
  key: string,
): Promise<{ data: DailySummaryBundle; isStale: boolean } | null> {
  return getResourceCached<DailySummaryBundle>(key)
}

export function setCachedSummary(
  key: string,
  data: DailySummaryBundle,
  ttlMs: number,
): Promise<void> {
  return setResourceCached(key, data, ttlMs)
}

export function invalidateSummaryCache(key: string): Promise<void> {
  return invalidateResourceCache(key)
}

/** Drop unified summary + insights day/week caches for one date. */
export async function invalidateUserDayCaches(userId: string, date: string): Promise<void> {
  const weekStart = getWeekStart(new Date(`${date}T12:00:00`))
  await Promise.all([
    invalidateSummaryCache(buildSummaryCacheKey(userId, date)),
    invalidateDay(userId, date),
    invalidateInsightsKey(buildWeekKey(userId, weekStart)),
    invalidateResourceCache(buildResourceKey('summary-weekly', userId, weekStart)),
  ])
}

export async function invalidateUserTodayCaches(userId: string): Promise<void> {
  await invalidateUserDayCaches(userId, getLocalDateString())
}

// ── Network fetch (single entry point) ───────────────────────────────────────

export function fetchDailySummaryBundle(
  userId: string,
  date: string,
  options?: { force?: boolean },
): Promise<DailySummaryBundle | null> {
  const key = buildSummaryCacheKey(userId, date)
  return fetchWithResourceCache<DailySummaryBundle>(
    key,
    ttlForDate(date),
    async () => {
      const { ok, body } = await apiFetch(`/summary/daily/${date}`)
      if (!ok) return null
      return bundleFromApiBody(body as Record<string, unknown>)
    },
    { force: options?.force ?? false },
  )
}
