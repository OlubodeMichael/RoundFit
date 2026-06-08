import type { SessionMetricsSource } from '@/utils/session-metrics';

/** Post-session summary shown after a live workout is saved. */
export interface SessionRecapData {
  workoutName: string;
  durationMs: number;
  caloriesBurned: number;
  caloriesSource: SessionMetricsSource;
  avgHeartRate?: number;
  strainScore?: number;
  /** Strength sessions — total kg lifted (reps × weight). */
  volumeKg?: number;
  /** Cardio burn sessions — % of calorie goal reached. */
  goalPercent?: number;
  isStrength: boolean;
}
