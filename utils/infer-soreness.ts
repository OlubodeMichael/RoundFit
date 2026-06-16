import type { Workout, WorkoutIntensity, WorkoutType } from '@/context/workout-context';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import { countConsecutiveHardDays } from '@/utils/workout-readiness';

const DEFAULT_STEP_BASELINE = 7000;

/** DOMS peaks 24–48 h post-effort — weight recent days, not today. */
const DOMS_WEIGHT: Record<number, number> = {
  0: 0.3,
  1: 1.0,
  2: 0.8,
  3: 0.4,
};

const INTENSITY_MULTIPLIER: Record<WorkoutIntensity, number> = {
  light:     1.0,
  moderate:  1.5,
  hard:      2.5,
};

/** Eccentric-heavy modalities produce more DOMS than steady-state cardio. */
const ECCENTRIC_TYPES = new Set<WorkoutType>([
  'gym',
  'running',
  'hiit',
  'walking',
]);

/** Steps above baseline contribute to soreness (per 3000 excess steps). */
const STEPS_PER_STRAIN_UNIT = 3000;

/** Maps raw mechanical load to the 1–10 soreness scale. Tune against logged soreness. */
const LOAD_TO_SORENESS_DIVISOR = 2.5;

export interface StepDayInput {
  date: string;
  steps: number;
}

export interface InferSorenessInput {
  workouts: Workout[];
  /** Days 1–3 ago with step counts (today excluded — not accrued yet). */
  stepDays: StepDayInput[];
  avgDailySteps: number | null;
  today?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function workoutDay(w: Workout): string {
  return w.date
    ?? (w.started_at
      ? getLocalDateString(new Date(w.started_at))
      : w.created_at.slice(0, 10));
}

function daysAgoFromToday(date: string, today: string): number {
  for (let i = 0; i <= 7; i++) {
    if (addLocalCalendarDays(today, -i) === date) return i;
  }
  return 99;
}

function eccentricFactor(type: WorkoutType): number {
  return ECCENTRIC_TYPES.has(type) ? 1.3 : 1.0;
}

function sessionStrain(w: Workout): number {
  const mult = w.intensity ? INTENSITY_MULTIPLIER[w.intensity] : INTENSITY_MULTIPLIER.moderate;
  return (w.duration_mins / 30) * mult * eccentricFactor(w.type);
}

/**
 * Infer muscle soreness (1–10) from workout sessions and ambient step load
 * over the last 72 hours when the user has not logged soreness manually.
 */
export function computeInferredSoreness(input: InferSorenessInput): number {
  const today = input.today ?? getLocalDateString();
  const stepBaseline = input.avgDailySteps ?? DEFAULT_STEP_BASELINE;

  let workoutLoad = 0;
  for (const w of input.workouts) {
    const day = workoutDay(w);
    const daysAgo = daysAgoFromToday(day, today);
    if (daysAgo > 3) continue;
    workoutLoad += sessionStrain(w) * (DOMS_WEIGHT[daysAgo] ?? 0);
  }

  let stepLoad = 0;
  for (const row of input.stepDays) {
    const daysAgo = daysAgoFromToday(row.date, today);
    if (daysAgo > 3 || daysAgo === 0) continue;
    const excess = Math.max(0, row.steps - stepBaseline);
    stepLoad += (excess / STEPS_PER_STRAIN_UNIT) * (DOMS_WEIGHT[daysAgo] ?? 0);
  }

  const rawLoad = workoutLoad + stepLoad * 0.6;
  let soreness = 1 + rawLoad / LOAD_TO_SORENESS_DIVISOR;

  const consecutiveHard = countConsecutiveHardDays(input.workouts);
  if (consecutiveHard >= 2) soreness += 2;
  if (consecutiveHard >= 3) soreness += 2;

  return clamp(Math.round(soreness), 1, 10);
}

/** Simple mean of positive daily step counts for a personal activity baseline. */
export function computeStepsBaseline(stepValues: number[]): number | null {
  const valid = stepValues.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}
