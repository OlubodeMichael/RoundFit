import type { CheckIn } from '@/context/checkin-context';
import type { CurrentCycle } from '@/context/cycle-context';
import type { HealthData } from '@/context/health-context';
import type { RecoveryLog } from '@/context/recovery-context';
import type { DailySummary } from '@/context/summary-context';
import type { Workout } from '@/context/workout-context';
import type { ReadinessInput, ReadinessWorkoutInput } from '@/types/readiness';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import { computeInferredSoreness, type StepDayInput } from '@/utils/infer-soreness';
import { CYCLE_ENABLED } from '@/constants/features';
import { countConsecutiveHardDays } from '@/utils/workout-readiness';

/** 1 logged glass = 250 ml (matches the hydration tracker convention). */
const GLASS_ML = 250;

/** Map a logged workout session row into readiness training-load input. */
export function workoutToReadinessInput(w: Workout): ReadinessWorkoutInput {
  const date = w.date
    ?? (w.started_at
      ? getLocalDateString(new Date(w.started_at))
      : w.created_at.slice(0, 10));
  return {
    date,
    duration_mins: w.duration_mins,
    intensity:     w.intensity,
  };
}

/** Calendar dates for the prior 7-day window (8–14 days ago, inclusive). */
export function datesPrior7(fromDate = getLocalDateString()): string[] {
  const out: string[] = [];
  for (let i = 13; i >= 7; i--) {
    out.push(addLocalCalendarDays(fromDate, -i));
  }
  return out;
}

export interface BuildReadinessSources {
  recoveryLog: RecoveryLog | null;
  healthToday: HealthData | null;
  checkinToday: CheckIn | null;
  cycle: CurrentCycle | null;
  userSex: 'male' | 'female';
  yesterdaySummary: DailySummary | null;
  /** Day-before-yesterday summary, for the 48-hour nutrition window. */
  dayBeforeSummary: DailySummary | null;
  /** Logged sessions in the last 7 calendar days. */
  workouts7d: Workout[];
  /** Logged sessions from 8–14 days ago. */
  workoutsPrior7d: Workout[];
  hrvBaseline: number | null;
  restingHrBaseline: number | null;
  restingHeartRateYesterday: number | null;
  proteinTarget: number;
  calorieBudget: number;
  /** Water logged so far today, in glasses. */
  waterGlassesToday: number | null;
  /** Daily water goal, in ml. */
  waterGoalMl: number;
  /** Step counts for days 1–3 ago (ambient load for soreness inference). */
  recentStepDays: StepDayInput[];
  /** Rolling average daily steps; null falls back to 7000 in inference. */
  avgDailySteps: number | null;
}

/**
 * Consecutive hard-training days ending yesterday — re-exported for readiness input.
 */
export { countConsecutiveHardDays } from '@/utils/workout-readiness';

function inferSoreness(sources: BuildReadinessSources): number {
  return computeInferredSoreness({
    workouts:        sources.workouts7d,
    stepDays:        sources.recentStepDays,
    avgDailySteps:   sources.avgDailySteps,
  });
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
    yesterdaySummary, dayBeforeSummary, workouts7d, workoutsPrior7d,
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
      hrv:                            recoveryLog?.hrv ?? healthToday?.hrv ?? null,
      resting_heart_rate:             recoveryLog?.resting_heart_rate ?? healthToday?.resting_heart_rate ?? null,
      hrv_baseline:                   sources.hrvBaseline,
      resting_hr_baseline:            sources.restingHrBaseline,
      resting_heart_rate_yesterday:   sources.restingHeartRateYesterday,
      resting_hr_baseline_yesterday:  sources.restingHrBaseline,
    },
    workouts_7d:       workouts7d.map(workoutToReadinessInput),
    workouts_prior_7d: workoutsPrior7d.map(workoutToReadinessInput),
    nutrition: nutritionFromSummary(yesterdaySummary, sources.proteinTarget, sources.calorieBudget) ?? {
      calories_consumed: null,
      calorie_budget:    sources.calorieBudget,
      protein_consumed:  null,
      protein_target:    sources.proteinTarget,
    },
    nutrition_prev: nutritionFromSummary(dayBeforeSummary, sources.proteinTarget, sources.calorieBudget),
    soreness: {
      soreness_level: recoveryLog?.soreness_level ?? inferSoreness(sources),
      energy_level:   checkinToday?.energy_level ?? null,
      inferred:       recoveryLog?.soreness_level == null,
    },
    cycle: {
      phase:           cycle?.phase ?? null,
      days_remaining:  cycle?.days_remaining ?? null,
      include_cycle:   CYCLE_ENABLED && userSex === 'female' && cycle?.phase !== null,
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
