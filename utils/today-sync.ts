import { invalidateUserTodayCaches } from '@/utils/daily-summary-cache'

type Listener = () => void | Promise<void>

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
 * After logging food/workouts/health/etc.: invalidate caches and refetch
 * aggregated day endpoints.
 */
export async function syncTodayAfterMutation(userId: string | null | undefined): Promise<void> {
  if (!userId) return

  if (dataSyncInFlight) {
    await dataSyncInFlight
    return
  }

  dataSyncInFlight = (async () => {
    await invalidateUserTodayCaches(userId)
    await Promise.all(
      Array.from(dataListeners).map((listener) => Promise.resolve(listener())),
    )
  })().finally(() => {
    dataSyncInFlight = null
  })

  await dataSyncInFlight
}

/**
 * After profile/target edits: refresh derived scores from existing data only.
 * Does not call GET /summary, /engine, or /insights.
 */
export function notifyTodayTargetsChanged(): void {
  targetsListeners.forEach((listener) => {
    void Promise.resolve(listener())
  })
}
