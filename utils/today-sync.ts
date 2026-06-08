import { invalidateUserTodayCaches } from '@/utils/daily-summary-cache'
import type { MutationDomain } from '@/utils/cache-invalidation'
import { invalidateAfterMutation } from '@/utils/cache-invalidation'

export type { MutationDomain }

export interface TodayDataChangedContext {
  domain: MutationDomain
}

type Listener = (ctx: TodayDataChangedContext) => void | Promise<void>

/** Server-backed day data changed (meals, workouts, health, water, etc.). */
const dataListeners = new Set<Listener>()

/** Targets / profile changed — recompute UI locally, no summary fetch. */
const targetsListeners = new Set<Listener>()

let dataSyncInFlight: Promise<void> | null = null

export function registerTodayDataSyncListener(listener: Listener): () => void {
  dataListeners.add(listener)
  return () => dataListeners.delete(listener)
}

export function registerTodayTargetsListener(listener: Listener): () => void {
  targetsListeners.add(listener)
  return () => targetsListeners.delete(listener)
}

/** @deprecated Use registerTodayDataSyncListener */
export function registerTodaySyncListener(listener: Listener): () => void {
  return registerTodayDataSyncListener(listener)
}

/**
 * Invalidate caches and notify listeners after a domain mutation.
 * Listeners should check `ctx.domain` before refetching heavy endpoints.
 */
export async function notifyTodayDataChanged(
  userId: string | null | undefined,
  domain: MutationDomain,
  date?: string,
): Promise<void> {
  if (!userId) return

  if (dataSyncInFlight) {
    await dataSyncInFlight
    return
  }

  const ctx: TodayDataChangedContext = { domain }

  dataSyncInFlight = (async () => {
    await invalidateAfterMutation({ userId, date, domain })
    await Promise.all(
      Array.from(dataListeners).map((listener) => Promise.resolve(listener(ctx))),
    )
  })().finally(() => {
    dataSyncInFlight = null
  })

  await dataSyncInFlight
}

/**
 * After logging food/workouts/health/etc.: invalidate caches and refetch
 * aggregated day endpoints (narrow refetch via listener domain checks).
 */
export async function syncTodayAfterMutation(
  userId: string | null | undefined,
  domain: MutationDomain = 'food',
  date?: string,
): Promise<void> {
  await notifyTodayDataChanged(userId, domain, date)
}

/** Full invalidation + listener fan-out (pull-to-refresh, explicit refresh). */
export async function syncTodayFullRefresh(
  userId: string | null | undefined,
): Promise<void> {
  await notifyTodayDataChanged(userId, 'full')
}

/** @deprecated Prefer invalidateAfterMutation — kept for direct summary+insights day drop */
export async function invalidateTodaySummaryCaches(userId: string): Promise<void> {
  await invalidateUserTodayCaches(userId)
}

/**
 * After profile/target edits: refresh derived scores from existing data only.
 * Does not call GET /summary, /engine, or /insights.
 */
export function notifyTodayTargetsChanged(): void {
  const ctx: TodayDataChangedContext = { domain: 'profile-targets' }
  targetsListeners.forEach((listener) => {
    void Promise.resolve(listener(ctx))
  })
}
