/**
 * Authoritative health row for a day, written through after a recovery/sleep log.
 * The recovery context emits the raw `health_data` row returned by POST /recovery/log;
 * the health context (the only owner of health state) subscribes, parses, and updates
 * its `today` + cache — closing the gap where manual sleep never reached health state.
 */
export interface HealthReconcileBundle {
  date: string
  /** Raw API `health_data` row — parsed by the health context's `fromApiData`. */
  row: Record<string, unknown>
}

type HealthReconcileListener = (bundle: HealthReconcileBundle) => void

const listeners = new Set<HealthReconcileListener>()

export function registerHealthReconcileListener(listener: HealthReconcileListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function applyHealthReconcile(bundle: HealthReconcileBundle): void {
  listeners.forEach((listener) => listener(bundle))
}
