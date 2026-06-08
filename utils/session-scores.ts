import type { WorkoutIntensity } from '@/context/workout-context';
import type { SessionSet, WorkoutSessionMode } from '@/types/workout-session';
import type { CaloriesSource, HrZoneMinutes, SessionScores } from '@/types/session-scores';
import type { SessionMetrics, SessionMetricsSource } from '@/utils/session-metrics';

/** Aligns with `INTENSITY_MULTIPLIER` in `utils/readiness.ts` → `workoutStrain`. */
const INTENSITY_MULTIPLIER: Record<WorkoutIntensity, number> = {
  light: 1.0,
  moderate: 1.5,
  hard: 2.5,
};

/** 60 min hard session (150 raw strain) maps to strain_score 100. */
const STRAIN_REFERENCE = 150;

const DEFAULT_USER_AGE = 30;

/** Standard 5-zone model — percent of age-predicted max HR. */
const HR_ZONE_THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.9] as const;

export interface ComputeSessionScoresInput {
  mode: WorkoutSessionMode;
  durationMins: number;
  intensity?: WorkoutIntensity;
  sets?: SessionSet[];
  metrics?: SessionMetrics | null;
  calorieGoal?: number;
  userAge?: number;
  /** True when calories come from a bound Apple Watch HKWorkout sample. */
  healthkitBound?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Same formula as `workoutStrain` in readiness — duration × intensity multiplier. */
function baseStrain(durationMins: number, intensity?: WorkoutIntensity): number {
  if (!Number.isFinite(durationMins) || durationMins <= 0) return 0;
  const mult = intensity ? INTENSITY_MULTIPLIER[intensity] : INTENSITY_MULTIPLIER.moderate;
  return durationMins * mult;
}

function maxHeartRateFromAge(userAge?: number): number {
  const age = userAge != null && userAge > 0 && userAge < 120 ? userAge : DEFAULT_USER_AGE;
  return 220 - age;
}

/**
 * Scales strain when HR data is present — higher avg HR relative to max HR
 * increases load (doc: duration × intensity × HR factor).
 */
function heartRateFactor(avgHeartRate: number, maxHr: number): number {
  if (!Number.isFinite(avgHeartRate) || avgHeartRate <= 0 || maxHr <= 0) return 1;
  const pct = avgHeartRate / maxHr;
  if (pct < 0.5) return 0.85;
  if (pct < 0.6) return 0.95;
  if (pct < 0.7) return 1.0;
  if (pct < 0.8) return 1.15;
  if (pct < 0.9) return 1.3;
  return 1.45;
}

export function computeStrainScore(
  durationMins: number,
  intensity?: WorkoutIntensity,
  avgHeartRate?: number,
  userAge?: number,
): number {
  const raw = baseStrain(durationMins, intensity);
  if (raw <= 0) return 0;

  let adjusted = raw;
  if (avgHeartRate != null && avgHeartRate > 0) {
    adjusted = raw * heartRateFactor(avgHeartRate, maxHeartRateFromAge(userAge));
  }

  return Math.round(clamp((adjusted / STRAIN_REFERENCE) * 100, 0, 100));
}

function zoneIndexFromPercent(percent: number): number {
  if (percent < HR_ZONE_THRESHOLDS[0]) return 0;
  for (let i = HR_ZONE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (percent >= HR_ZONE_THRESHOLDS[i]) return i;
  }
  return 0;
}

/**
 * Estimates zone minutes from session avg HR when per-sample HR is unavailable.
 * All active minutes are assigned to the zone matching avg HR.
 */
export function computeHrZoneMinutes(
  durationMins: number,
  avgHeartRate: number,
  userAge?: number,
): HrZoneMinutes {
  const empty: HrZoneMinutes = { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };
  if (!Number.isFinite(durationMins) || durationMins <= 0) return empty;
  if (!Number.isFinite(avgHeartRate) || avgHeartRate <= 0) return empty;

  const maxHr = maxHeartRateFromAge(userAge);
  const zoneIdx = zoneIndexFromPercent(avgHeartRate / maxHr);
  const minutes = Math.round(durationMins * 10) / 10;
  const keys: (keyof HrZoneMinutes)[] = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5'];
  return { ...empty, [keys[zoneIdx]]: minutes };
}

export function computeTotalVolumeKg(sets: SessionSet[]): number {
  return sets.reduce(
    (acc, s) => acc + (s.weightKg > 0 && s.reps > 0 ? s.weightKg * s.reps : 0),
    0,
  );
}

/** Maps live metrics source to recap calorie badge. */
export function mapCaloriesSource(
  source: SessionMetricsSource | undefined,
  healthkitBound?: boolean,
): CaloriesSource {
  if (source === 'healthkit') return healthkitBound ? 'watch' : 'health';
  if (source === 'delta') return 'health';
  if (source === 'met') return 'estimated';
  return 'estimated';
}

export function computeGoalPercent(caloriesBurned: number, calorieGoal?: number): number | undefined {
  if (calorieGoal == null || calorieGoal <= 0) return undefined;
  if (!Number.isFinite(caloriesBurned) || caloriesBurned < 0) return undefined;
  return Math.round((caloriesBurned / calorieGoal) * 100);
}

/** Pure session scoring — no React, safe to call at session end or on import. */
export function computeSessionScores(input: ComputeSessionScoresInput): SessionScores {
  const {
    mode,
    durationMins,
    intensity,
    sets,
    metrics,
    calorieGoal,
    userAge,
    healthkitBound,
  } = input;

  const avgHeartRate = metrics?.avgHeartRate;
  const caloriesSource = mapCaloriesSource(metrics?.source, healthkitBound);

  const strain_score = computeStrainScore(durationMins, intensity, avgHeartRate, userAge);

  const scores: SessionScores = {
    strain_score,
    caloriesSource,
  };

  if (
    mode === 'cardio'
    && avgHeartRate != null
    && avgHeartRate > 0
  ) {
    scores.hr_zone_minutes = computeHrZoneMinutes(durationMins, avgHeartRate, userAge);
  }

  if (mode === 'cardio') {
    const goalPercent = computeGoalPercent(metrics?.caloriesBurned ?? 0, calorieGoal);
    if (goalPercent != null) scores.goalPercent = goalPercent;
  }

  if (mode === 'strength' && sets != null && sets.length > 0) {
    scores.volume_kg = computeTotalVolumeKg(sets);
  }

  return scores;
}
