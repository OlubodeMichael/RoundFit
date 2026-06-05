import { getLocalDateString } from '@/utils/date'
import {
  buildSummaryCacheKey,
  invalidateSummaryCache,
  invalidateUserDayCaches,
} from '@/utils/daily-summary-cache'
import { getWeekStart } from '@/utils/insights-aggregator'
import {
  buildDayKey,
  buildWeekKey,
  invalidate as invalidateInsightsKey,
} from '@/utils/insights-cache'
import {
  buildResourceKey,
  invalidateKeys,
  invalidateResourceCache,
} from '@/utils/resource-cache'
import { invalidateHealthKitWorkoutScanCache } from '@/utils/workout-hk-cache'

export type MutationDomain =
  | 'food'
  | 'workout'
  | 'water'
  | 'health'
  | 'checkin'
  | 'recovery'
  | 'cycle'
  | 'summary'
  | 'engine'
  | 'profile-targets'
  | 'full'

export interface InvalidateAfterMutationOptions {
  userId: string
  date?: string
  domain: MutationDomain
}

/** Canonical weekly summary cache key (shared by summary-context and use-weekly-insights). */
export function buildSummaryWeeklyResourceKey(
  userId: string,
  weekStart: string,
): string {
  return buildResourceKey('summary-weekly', userId, weekStart)
}

async function invalidateWeeklyCaches(userId: string, weekStart: string): Promise<void> {
  await Promise.all([
    invalidateResourceCache(buildSummaryWeeklyResourceKey(userId, weekStart)),
    invalidateInsightsKey(buildWeekKey(userId, weekStart)),
  ])
}

/**
 * Invalidate caches after a mutation. Does not refetch — callers use
 * `notifyTodayDataChanged` or domain-specific refresh.
 */
export async function invalidateAfterMutation({
  userId,
  date,
  domain,
}: InvalidateAfterMutationOptions): Promise<void> {
  const targetDate = date ?? getLocalDateString()
  const today = getLocalDateString()
  const weekStart = getWeekStart(new Date(`${targetDate}T12:00:00`))

  const keys: string[] = []

  switch (domain) {
    case 'food':
      keys.push(buildResourceKey('food-logs', userId, targetDate))
      break
    case 'workout':
      keys.push(
        buildResourceKey('workouts', userId, targetDate),
        buildResourceKey('workouts-history', userId, '30'),
      )
      await invalidateHealthKitWorkoutScanCache(userId)
      break
    case 'water':
      keys.push(buildResourceKey('water', userId, targetDate))
      break
    case 'health':
      keys.push(buildResourceKey('health', userId, targetDate))
      break
    case 'checkin':
      keys.push(buildResourceKey('checkin-today', userId, targetDate))
      break
    case 'recovery':
      keys.push(
        buildResourceKey('recovery-today', userId, targetDate),
        buildResourceKey('recovery-readiness', userId, targetDate),
        buildResourceKey('recovery-history', userId, targetDate.slice(0, 7)),
        buildResourceKey('health-baselines', userId, targetDate),
      )
      break
    case 'cycle':
      keys.push(buildResourceKey('cycle', userId))
      break
    case 'engine':
      keys.push(
        buildResourceKey('engine-daily', userId, targetDate),
        buildResourceKey('engine-patterns', userId, targetDate),
      )
      break
    case 'summary':
      await invalidateSummaryCache(buildSummaryCacheKey(userId, targetDate))
      if (targetDate === today) {
        await invalidateWeeklyCaches(userId, weekStart)
      }
      return
    case 'profile-targets':
      return
    case 'full':
      await invalidateUserDayCaches(userId, targetDate)
      await invalidateWeeklyCaches(userId, weekStart)
      await invalidateHealthKitWorkoutScanCache(userId)
      keys.push(
        buildResourceKey('food-logs', userId, targetDate),
        buildResourceKey('workouts', userId, targetDate),
        buildResourceKey('workouts-history', userId, '30'),
        buildResourceKey('water', userId, targetDate),
        buildResourceKey('health', userId, targetDate),
        buildResourceKey('checkin-today', userId, targetDate),
        buildResourceKey('insights-today', userId, targetDate),
        buildResourceKey('insights-history', userId, targetDate),
        buildResourceKey('engine-daily', userId, targetDate),
        buildResourceKey('engine-patterns', userId, targetDate),
      )
      break
  }

  if (domain !== 'full' && targetDate === today) {
    await invalidateUserDayCaches(userId, targetDate)
    await invalidateWeeklyCaches(userId, weekStart)
  }

  if (domain === 'food' || domain === 'workout' || domain === 'water' || domain === 'health') {
    await invalidateInsightsKey(buildDayKey(userId, targetDate))
  }

  if (keys.length > 0) {
    await invalidateKeys(keys)
  }
}

/** Domains that should trigger summary-provider listener refetch. */
export function shouldRefetchSummaryAfterMutation(domain: MutationDomain): boolean {
  // 'water' is intentionally excluded: the daily summary's only water field
  // (water_glasses) is never displayed or scored on the client — water UI reads
  // from water-context (ml-based). Refetching /summary/daily on every water log
  // updated a field nothing consumes.
  return (
    domain === 'full' ||
    domain === 'summary' ||
    domain === 'food' ||
    domain === 'workout' ||
    domain === 'health' ||
    domain === 'checkin' ||
    domain === 'recovery'
  )
}

export function shouldRefetchInsightsTodayAfterMutation(domain: MutationDomain): boolean {
  return domain === 'full' || domain === 'summary'
}

export function shouldRefetchEngineAfterMutation(domain: MutationDomain): boolean {
  return domain === 'full' || domain === 'health' || domain === 'recovery'
}

/**
 * Domains that change recovery/readiness inputs (sleep, HRV, resting HR, energy,
 * training strain) and should trigger a recovery-provider refetch. Without this,
 * sleep logged via HealthKit sync or the sleep screen sits in a 2 h-fresh cache
 * and never reaches the Recovery screen until a forced refresh / re-login.
 */
export function shouldRefetchRecoveryAfterMutation(domain: MutationDomain): boolean {
  return (
    domain === 'full' ||
    domain === 'health' ||
    domain === 'recovery' ||
    domain === 'checkin' ||
    domain === 'workout'
  )
}

export function shouldRefetchDailyInsightsAfterMutation(domain: MutationDomain): boolean {
  return (
    domain === 'full' ||
    domain === 'summary' ||
    domain === 'food' ||
    domain === 'workout' ||
    domain === 'water' ||
    domain === 'health'
  )
}
