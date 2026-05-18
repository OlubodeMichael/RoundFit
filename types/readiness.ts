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
  | 'cycle';

export const PILLAR_WEIGHTS: Record<ReadinessPillarId, number> = {
  sleep:          0.30,
  hrv:            0.20,
  training_load:  0.20,
  nutrition:      0.10,
  soreness:       0.10,
  cycle:          0.10,
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
  workouts_7d: ReadinessWorkoutInput[];
  nutrition: NutritionScoreInput;
  soreness: SorenessScoreInput;
  cycle: CycleScoreInput;
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
}

export interface ReadinessHistoryPoint {
  date: string;
  score: number;
}
