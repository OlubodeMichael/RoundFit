import type { CyclePhase } from '@/context/cycle-context';
import type { EnergyLevel } from '@/context/checkin-context';
import type { SleepQuality } from '@/context/recovery-context';
import type { WorkoutIntensity } from '@/context/workout-context';

/** Pillar identifiers used in weighted aggregation. */
export type ReadinessPillarId =
  | 'sleep'
  | 'hrv'
  | 'training_load'
  | 'nutrition'
  | 'soreness'
  | 'cycle'
  | 'hydration';

// v3 weights — HRV leads (autonomic readout); sleep supports; nutrition nudges.
export const PILLAR_WEIGHTS: Record<ReadinessPillarId, number> = {
  hrv:            0.26,
  sleep:          0.23,
  training_load:  0.18,
  soreness:       0.11,
  nutrition:      0.05,
  cycle:          0.09,
  hydration:      0.05,
};

export type ReadinessRecommendation =
  | 'Rest'
  | 'Light workout'
  | 'Moderate'
  | 'Train hard';

export type FactorStatus = 'good' | 'ok' | 'poor';

/** Minimal workout row for training-load math. */
export interface ReadinessWorkoutInput {
  date: string;
  duration_mins: number;
  intensity?: WorkoutIntensity;
}

export interface SleepScoreInput {
  sleep_hours: number | null;
  deep_sleep_hours: number | null;
  rem_sleep_hours: number | null;
  /** Check-in scale 1–5, or null. */
  sleep_quality_rating: number | null;
  /** HealthKit sleep efficiency 0–100, or null. */
  sleep_efficiency: number | null;
}

export interface HrvScoreInput {
  hrv: number | null;
  resting_heart_rate: number | null;
  hrv_baseline: number | null;
  resting_hr_baseline: number | null;
  /** Prior-day resting HR for consecutive-elevation override. */
  resting_heart_rate_yesterday: number | null;
  resting_hr_baseline_yesterday: number | null;
}

export interface NutritionScoreInput {
  calories_consumed: number | null;
  calorie_budget: number | null;
  protein_consumed: number | null;
  protein_target: number | null;
}

export interface SorenessScoreInput {
  soreness_level: number | null;
  energy_level: EnergyLevel | null;
  /** True when soreness_level was inferred from workouts, not logged by the user. */
  inferred: boolean;
}

export interface HydrationScoreInput {
  /** Water logged so far today, in ml. */
  logged_ml: number | null;
  /** Daily water goal, in ml. */
  target_ml: number | null;
}

export interface CycleScoreInput {
  phase: CyclePhase;
  days_remaining: number | null;
  /** When false, cycle pillar is skipped. */
  include_cycle: boolean;
}

/** All signals passed into `computeReadiness`. */
export interface ReadinessInput {
  sleep: SleepScoreInput;
  hrv: HrvScoreInput;
  /** Logged workout sessions in the last 7 calendar days (inclusive). */
  workouts_7d: ReadinessWorkoutInput[];
  /** Logged sessions from 8–14 days ago — used for detraining detection. */
  workouts_prior_7d: ReadinessWorkoutInput[];
  nutrition: NutritionScoreInput;
  /** Day-before-yesterday nutrition, for the 48-hour weighted window. */
  nutrition_prev: NutritionScoreInput | null;
  soreness: SorenessScoreInput;
  cycle: CycleScoreInput;
  hydration: HydrationScoreInput;
  /** Consecutive hard-training days ending yesterday. */
  consecutive_hard_days: number;
  /** Optional subjective sleep quality from recovery log. */
  sleep_quality_label: SleepQuality | null;
}

export interface PillarScore {
  id: ReadinessPillarId;
  label: string;
  score: number;
  weight: number;
  /** Whether this pillar had enough data to contribute. */
  active: boolean;
}

export interface ReadinessFactor {
  pillar: ReadinessPillarId;
  label: string;
  icon: string;
  value: string;
  note: string;
  status: FactorStatus;
  score: number;
  ringScore?: number;
  /** Overrides the default Strong / Steady / Low label in the UI. */
  statusLabel?: string;
  /** When true, pillar is shown greyed and does not contribute to the score. */
  inactive?: boolean;
}

export type TrainingLoadStatus = 'no_data' | 'detraining' | 'active';

export interface TrainingLoadResult {
  score: number | null;
  status: TrainingLoadStatus;
  label: string;
  note: string;
  active: boolean;
  acr?: number;
}

export interface ReadinessTip {
  icon: string;
  text: string;
}

export interface ComputedReadiness {
  score: number;
  recommendation: ReadinessRecommendation;
  reason: string;
  pillars: PillarScore[];
  factors: ReadinessFactor[];
  tips: ReadinessTip[];
  sleep_score: number | null;
  strain_score: number | null;
  soreness_level: number | null;
}

export interface ReadinessHistoryPoint {
  date: string;
  score: number;
}
