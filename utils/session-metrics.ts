/** How session calories were resolved — useful for badges and Live Activity copy. */
export type SessionMetricsSource = 'healthkit' | 'delta' | 'met';

export interface SessionMetrics {
  caloriesBurned: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  source: SessionMetricsSource;
}

/** HK workout stats passed into the pure resolver (fetched async by the hook). */
export interface HealthKitSessionMetricsInput {
  caloriesBurned: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
}

export interface ResolveSessionMetricsInput {
  /** Elapsed active session time in minutes (pause-adjusted `startedAt`). */
  elapsedMinutes: number;
  baselineActiveCalories: number;
  currentActiveCalories: number;
  weightKg: number;
  met: number;
  healthKitMetrics?: HealthKitSessionMetricsInput | null;
  /** Intraday HR from health sync — used when HK workout HR is unavailable. */
  fallbackHeartRate?: {
    avgHeartRate?: number;
    maxHeartRate?: number;
  };
}

export const DEFAULT_SESSION_MET = 6.0;
export const DEFAULT_SESSION_WEIGHT_KG = 70;

/** MET × weight (kg) × hours — inverse of `computeDurationMinutes` in burn picker. */
export function estimateCaloriesFromMet(
  met: number,
  weightKg: number,
  elapsedMinutes: number,
): number {
  if (!Number.isFinite(met) || met <= 0) return 0;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes <= 0) return 0;
  return Math.max(0, Math.round(met * weightKg * (elapsedMinutes / 60)));
}

/** Active elapsed minutes from pause-adjusted session `startedAt`. */
export function sessionElapsedMinutes(startedAtMs: number, nowMs: number = Date.now()): number {
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return 0;
  return Math.max(0, (nowMs - startedAtMs) / 60_000);
}

/**
 * Resolves live session calories with priority:
 * 1. HKWorkout-scoped energy (+ HR when present)
 * 2. `active_calories` delta since session baseline
 * 3. MET estimate from catalogue entry × profile weight × elapsed minutes
 */
export function resolveSessionMetrics(input: ResolveSessionMetricsInput): SessionMetrics {
  const hk = input.healthKitMetrics;
  const fallbackHr = input.fallbackHeartRate;

  let caloriesBurned: number;
  let source: SessionMetricsSource;

  if (hk && hk.caloriesBurned > 0) {
    caloriesBurned = Math.round(hk.caloriesBurned);
    source = 'healthkit';
  } else {
    const delta = Math.max(
      0,
      Math.round(input.currentActiveCalories - input.baselineActiveCalories),
    );
    if (delta > 0) {
      caloriesBurned = delta;
      source = 'delta';
    } else {
      caloriesBurned = estimateCaloriesFromMet(
        input.met,
        input.weightKg,
        input.elapsedMinutes,
      );
      source = 'met';
    }
  }

  const avgHeartRate = hk?.avgHeartRate ?? fallbackHr?.avgHeartRate;
  const maxHeartRate = hk?.maxHeartRate ?? fallbackHr?.maxHeartRate;

  return {
    caloriesBurned,
    ...(avgHeartRate != null && avgHeartRate > 0 ? { avgHeartRate } : {}),
    ...(maxHeartRate != null && maxHeartRate > 0 ? { maxHeartRate } : {}),
    source,
  };
}
