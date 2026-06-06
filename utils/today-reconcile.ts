import type { DailySummary } from '@/context/summary-context'

/** Authoritative server state for a single day, written through after a mutation. */
export interface TodayReconcileBundle {
  date: string
  summary: DailySummary
}

type ReconcileListener = (bundle: TodayReconcileBundle) => void

const listeners = new Set<ReconcileListener>()

export function registerTodayReconcileListener(listener: ReconcileListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function applyTodayReconcile(bundle: TodayReconcileBundle): void {
  listeners.forEach((listener) => listener(bundle))
}
