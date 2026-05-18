import type { CheckIn } from '@/context/checkin-context';
import type { CurrentCycle } from '@/context/cycle-context';
import type { HealthData } from '@/context/health-context';
import type { RecoveryLog } from '@/context/recovery-context';
import type { DailySummary } from '@/context/summary-context';
import type { Workout } from '@/context/workout-context';
import { addLocalCalendarDays } from '@/utils/date';
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
      soreness_level: recoveryLog?.soreness_level ?? null,
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
