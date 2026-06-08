import type { CheckIn } from '@/context/checkin-context';
import type { CurrentCycle } from '@/context/cycle-context';
import type { HealthData } from '@/context/health-context';
import type { RecoveryLog } from '@/context/recovery-context';
import type { DailySummary } from '@/context/summary-context';
import type { Workout } from '@/context/workout-context';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import type { ReadinessInput, ReadinessWorkoutInput } from '@/types/readiness';

/** 1 logged glass = 250 ml (matches the hydration tracker convention). */
const GLASS_ML = 250;

export interface BuildReadinessSources {
  recoveryLog: RecoveryLog | null;
  healthToday: HealthData | null;
  checkinToday: CheckIn | null;
  cycle: CurrentCycle | null;
  userSex: 'male' | 'female';
  yesterdaySummary: DailySummary | null;
  /** Day-before-yesterday summary, for the 48-hour nutrition window. */
  dayBeforeSummary: DailySummary | null;
  workouts7d: Workout[];
  hrvBaseline: number | null;
  restingHrBaseline: number | null;
  proteinTarget: number;
  calorieBudget: number;
  /** Water logged so far today, in glasses. */
  waterGlassesToday: number | null;
  /** Daily water goal, in ml. */
  waterGoalMl: number;
}

function workoutToInput(w: Workout): ReadinessWorkoutInput {
  return {
    date:          w.date ?? w.created_at.slice(0, 10),
    duration_mins: w.duration_mins,
    intensity:     w.intensity,
  };
}

const workoutDay = (w: Workout): string => w.date ?? w.created_at.slice(0, 10);

/**
 * Consecutive hard-training days ending yesterday. Two hard days back to back is
 * a real recovery risk; three or more should bias toward rest.
 */
export function countConsecutiveHardDays(workouts7d: Workout[]): number {
  const today = getLocalDateString();
  let streak = 0;
  for (let i = 1; i <= 7; i++) {
    const d = addLocalCalendarDays(today, -i);
    const hard = workouts7d.some((w) => workoutDay(w) === d && w.intensity === 'hard');
    if (!hard) break;
    streak += 1;
  }
  return streak;
}

// DOMS peaks 24–48 h after training — infer soreness from yesterday's workout
// when no manual soreness log is present.
function inferSorenessFromWorkouts(workouts7d: Workout[]): number | null {
  const today     = getLocalDateString();
  const yesterday = addLocalCalendarDays(today, -1);

  const yday = workouts7d.filter((w) => workoutDay(w) === yesterday);
  if (yday.length === 0) return 1; // no workout yesterday = not sore

  const BASE: Record<string, number> = { light: 2, moderate: 4, hard: 6 };
  let base = 0;
  let maxDuration = 0;
  for (const w of yday) {
    const b = BASE[w.intensity ?? 'moderate'] ?? 4;
    if (b > base) base = b;
    if (w.duration_mins > maxDuration) maxDuration = w.duration_mins;
  }

  const durationBonus = maxDuration >= 90 ? 2 : maxDuration >= 60 ? 1 : 0;

  // Consecutive hard days compound soreness meaningfully (item 5).
  const streak = countConsecutiveHardDays(workouts7d);
  const consecutivePenalty = streak >= 3 ? 5 : streak >= 2 ? 3 : 0;

  return Math.min(base + durationBonus + consecutivePenalty, 10);
}

function nutritionFromSummary(
  summary: DailySummary | null,
  proteinTarget: number,
  calorieBudgetFallback: number,
): import('@/types/readiness').NutritionScoreInput | null {
  if (!summary) return null;
  return {
    calories_consumed: summary.calories_consumed ?? null,
    calorie_budget:    summary.calorie_budget ?? calorieBudgetFallback,
    protein_consumed:  summary.protein_consumed ?? null,
    protein_target:    proteinTarget,
  };
}

/** Merge recovery log, HealthKit, and check-in into a single readiness input snapshot. */
export function buildReadinessInput(sources: BuildReadinessSources): ReadinessInput {
  const {
    recoveryLog, healthToday, checkinToday, cycle, userSex,
    yesterdaySummary, dayBeforeSummary, workouts7d,
    waterGlassesToday, waterGoalMl,
  } = sources;

  // Use || so that a 0 in the recovery log falls through to HealthKit data.
  const sleepHours = recoveryLog?.sleep_hours || healthToday?.sleep_hours || null;
  const deepSleep  = recoveryLog?.deep_sleep_hours || healthToday?.deep_sleep_hours || null;
  const remSleep   = recoveryLog?.rem_sleep_hours  || healthToday?.rem_sleep_hours  || null;

  const checkinSleep = checkinToday?.sleep_quality ?? null;

  return {
    sleep: {
      sleep_hours:            sleepHours,
      deep_sleep_hours:       deepSleep,
      rem_sleep_hours:        remSleep,
      sleep_quality_rating:   checkinSleep,
      sleep_efficiency:       healthToday?.sleep_efficiency ?? null,
    },
    hrv: {
      hrv:                   recoveryLog?.hrv ?? healthToday?.hrv ?? null,
      resting_heart_rate:    recoveryLog?.resting_heart_rate ?? healthToday?.resting_heart_rate ?? null,
      hrv_baseline:          sources.hrvBaseline,
      resting_hr_baseline:   sources.restingHrBaseline,
    },
    workouts_7d: workouts7d.map(workoutToInput),
    nutrition: nutritionFromSummary(yesterdaySummary, sources.proteinTarget, sources.calorieBudget) ?? {
      calories_consumed: null,
      calorie_budget:    sources.calorieBudget,
      protein_consumed:  null,
      protein_target:    sources.proteinTarget,
    },
    nutrition_prev: nutritionFromSummary(dayBeforeSummary, sources.proteinTarget, sources.calorieBudget),
    soreness: {
      soreness_level: recoveryLog?.soreness_level ?? inferSorenessFromWorkouts(workouts7d),
      energy_level:   checkinToday?.energy_level ?? null,
      inferred:       recoveryLog?.soreness_level == null,
    },
    cycle: {
      phase:           cycle?.phase ?? null,
      days_remaining:  cycle?.days_remaining ?? null,
      include_cycle:   userSex === 'female' && cycle?.phase !== null,
    },
    hydration: {
      logged_ml: waterGlassesToday != null ? waterGlassesToday * GLASS_ML : null,
      target_ml: waterGoalMl > 0 ? waterGoalMl : null,
    },
    consecutive_hard_days: countConsecutiveHardDays(workouts7d),
    sleep_quality_label: recoveryLog?.sleep_quality ?? null,
  };
}

export function yesterdayDateString(fromDate: string): string {
  return addLocalCalendarDays(fromDate, -1);
}
