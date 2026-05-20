import type { CheckIn } from '@/context/checkin-context';
import type { CurrentCycle } from '@/context/cycle-context';
import type { HealthData } from '@/context/health-context';
import type { RecoveryLog } from '@/context/recovery-context';
import type { DailySummary } from '@/context/summary-context';
import type { Workout } from '@/context/workout-context';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import type { ReadinessInput, ReadinessWorkoutInput } from '@/types/readiness';

export interface BuildReadinessSources {
  recoveryLog: RecoveryLog | null;
  healthToday: HealthData | null;
  checkinToday: CheckIn | null;
  cycle: CurrentCycle | null;
  userSex: 'male' | 'female';
  yesterdaySummary: DailySummary | null;
  workouts7d: Workout[];
  hrvBaseline: number | null;
  restingHrBaseline: number | null;
  proteinTarget: number;
  calorieBudget: number;
}

function workoutToInput(w: Workout): ReadinessWorkoutInput {
  return {
    date:          w.date ?? w.created_at.slice(0, 10),
    duration_mins: w.duration_mins,
    intensity:     w.intensity,
  };
}

// DOMS peaks 24–48 h after training — infer soreness from yesterday's workout
// when no manual soreness log is present.
function inferSorenessFromWorkouts(workouts7d: Workout[]): number | null {
  const today     = getLocalDateString();
  const yesterday = addLocalCalendarDays(today, -1);

  const yday = workouts7d.filter(
    (w) => (w.date ?? w.created_at.slice(0, 10)) === yesterday,
  );
  if (yday.length === 0) return 1; // no workout yesterday = not sore

  const BASE: Record<string, number> = { light: 2, moderate: 4, hard: 6 };
  let base = 0;
  let maxDuration = 0;
  for (const w of yday) {
    const b = BASE[w.intensity ?? 'moderate'] ?? 4;
    if (b > base) base = b;
    if (w.duration_mins > maxDuration) maxDuration = w.duration_mins;
  }

  const durationBonus   = maxDuration >= 90 ? 2 : maxDuration >= 60 ? 1 : 0;
  const twoDaysAgo      = addLocalCalendarDays(today, -2);
  const consecutiveBonus =
    base >= 6 &&
    workouts7d.some(
      (w) =>
        (w.date ?? w.created_at.slice(0, 10)) === twoDaysAgo &&
        w.intensity === 'hard',
    )
      ? 1
      : 0;

  return Math.min(base + durationBonus + consecutiveBonus, 10);
}

/** Merge recovery log, HealthKit, and check-in into a single readiness input snapshot. */
export function buildReadinessInput(sources: BuildReadinessSources): ReadinessInput {
  const { recoveryLog, healthToday, checkinToday, cycle, userSex, yesterdaySummary, workouts7d } = sources;

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
    nutrition: {
      calories_consumed: yesterdaySummary?.calories_consumed ?? null,
      calorie_budget:    yesterdaySummary?.calorie_budget ?? sources.calorieBudget,
      protein_consumed:  yesterdaySummary?.protein_consumed ?? null,
      protein_target:    sources.proteinTarget,
    },
    soreness: {
      soreness_level: recoveryLog?.soreness_level ?? inferSorenessFromWorkouts(workouts7d),
      energy_level:   checkinToday?.energy_level ?? null,
    },
    cycle: {
      phase:           cycle?.phase ?? null,
      days_remaining:  cycle?.days_remaining ?? null,
      include_cycle:   userSex === 'female' && cycle?.phase !== null,
    },
    sleep_quality_label: recoveryLog?.sleep_quality ?? null,
  };
}

export function yesterdayDateString(fromDate: string): string {
  return addLocalCalendarDays(fromDate, -1);
}
