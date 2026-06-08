/** How session calories were sourced — drives recap badge copy. */
export type CaloriesSource = 'watch' | 'health' | 'estimated';

/** Minutes spent in each HR zone (age-based max HR). */
export interface HrZoneMinutes {
  zone1: number;
  zone2: number;
  zone3: number;
  zone4: number;
  zone5: number;
}

/** Scores computed at session end for recap and downstream metrics. */
export interface SessionScores {
  /** Normalized training strain — 0 (easy) to 100 (very hard). */
  strain_score: number;
  /** Cardio only — populated when avg HR + user age are available. */
  hr_zone_minutes?: HrZoneMinutes;
  /** Strength only — total load (kg × reps) across logged sets. */
  volume_kg?: number;
  caloriesSource: CaloriesSource;
  /** Cardio only — percent of calorie goal reached (0–100+). */
  goalPercent?: number;
}
