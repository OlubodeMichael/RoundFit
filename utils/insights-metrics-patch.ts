import {
  TTL_SUMMARY_CURRENT_DAY,
  TTL_SUMMARY_PAST_DAY,
  buildSummaryCacheKey,
  getCachedSummary,
  setCachedSummary,
} from '@/utils/daily-summary-cache'
import { getLocalDateString } from '@/utils/date'
import {
  buildWeekDays,
  getWeekStart,
  recomputeNormalizedDay,
  type NormalizedDay,
  type WeeklyInsightSummary,
} from '@/utils/insights-aggregator'
import {
  TTL_CURRENT_WEEK,
  TTL_PAST_WEEK,
  buildWeekKey,
  getCached,
  setCached,
} from '@/utils/insights-cache'

export interface InsightsDayMetricsPatch {
  date: string
  sleep_hours?: number | null
  steps?: number | null
}

type PatchListener = (patch: InsightsDayMetricsPatch) => void

const listeners = new Set<PatchListener>()

export function registerInsightsMetricsPatchListener(listener: PatchListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function applyInsightsMetricsPatch(patch: InsightsDayMetricsPatch): void {
  listeners.forEach((listener) => listener(patch))
}

function ttlForSummaryDate(date: string): number {
  return date === getLocalDateString() ? TTL_SUMMARY_CURRENT_DAY : TTL_SUMMARY_PAST_DAY
}

export function patchNormalizedDayMetrics(
  day: NormalizedDay,
  patch: InsightsDayMetricsPatch,
  targets: WeeklyInsightSummary['targets_snapshot'],
): NormalizedDay {
  const merged: NormalizedDay = {
    ...day,
    ...(patch.sleep_hours != null ? { sleep_hours: patch.sleep_hours } : {}),
    ...(patch.steps != null ? { steps: patch.steps } : {}),
  }
  return recomputeNormalizedDay(merged, targets)
}

export function patchWeeklyInsightSummary(
  week: WeeklyInsightSummary,
  patch: InsightsDayMetricsPatch,
): WeeklyInsightSummary | null {
  const existing = week.days.find((d) => d.date === patch.date)
  if (!existing) return null

  const rescored = patchNormalizedDayMetrics(existing, patch, week.targets_snapshot)
  const patchedDays = week.days.map((d) => (d.date === patch.date ? rescored : d))
  const days = buildWeekDays(patchedDays, week.week_start)
  const logged = days.filter((x) => !x.is_partial)

  return {
    ...week,
    days,
    days_met_steps: logged.filter((x) => x.met_steps === 'met').length,
    days_met_sleep: logged.filter((x) => x.met_sleep === 'met').length,
  }
}

/** Persist sleep/steps into daily-summary + weekly insights caches after a recovery/health write. */
export async function writeThroughInsightsDayMetrics(
  userId: string,
  patch: InsightsDayMetricsPatch,
): Promise<void> {
  const { date, sleep_hours, steps } = patch
  if (sleep_hours == null && steps == null) return

  const dailyKey = buildSummaryCacheKey(userId, date)
  const dailyCached = await getCachedSummary(dailyKey)
  if (dailyCached) {
    const raw = { ...dailyCached.data.raw }
    if (sleep_hours != null) raw.sleep_hours = sleep_hours
    if (steps != null) raw.steps = steps
    await setCachedSummary(
      dailyKey,
      { ...dailyCached.data, raw },
      ttlForSummaryDate(date),
    )
  }

  const weekStart = getWeekStart(new Date(`${date}T12:00:00`))
  const weekKey = buildWeekKey(userId, weekStart)
  const weekCached = await getCached<WeeklyInsightSummary>(weekKey)
  if (!weekCached?.data) return

  const updated = patchWeeklyInsightSummary(weekCached.data, patch)
  if (!updated) return

  const ttl = weekStart === getWeekStart() ? TTL_CURRENT_WEEK : TTL_PAST_WEEK
  await setCached(weekKey, updated, ttl)
}
