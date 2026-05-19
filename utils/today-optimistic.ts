/** Immediate UI deltas before / while server sync runs. */
export interface TodayDataDelta {
  caloriesConsumed?: number
  proteinConsumed?: number
  carbsConsumed?: number
  fatConsumed?: number
  caloriesBurned?: number
  /** Set today's water glasses to this value (not a delta). */
  waterGlasses?: number
}

type OptimisticListener = (delta: TodayDataDelta) => void

const listeners = new Set<OptimisticListener>()

export function registerTodayOptimisticListener(listener: OptimisticListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function applyTodayOptimistic(delta: TodayDataDelta): void {
  listeners.forEach((listener) => listener(delta))
}
