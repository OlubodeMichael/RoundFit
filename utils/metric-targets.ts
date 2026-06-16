import { addLocalCalendarDays } from '@/utils/date';

/** Single source of truth for Progress, Consistency, Goals met, and Insights. */

export type MetMode = 'near' | 'at_least';

export const DEFAULT_STEPS_TARGET = 8000;
export const DEFAULT_SLEEP_TARGET = 7.5;
export const DAY_MET_THRESHOLD = 0.75;

const CALORIE_BAND_RATIO = 0.10;
const CALORIE_BAND_FLOOR = 150;

export function isMetricMet(
  actual: number | null,
  target: number | null,
  mode: MetMode,
): boolean | null {
  if (actual == null || target == null || target <= 0) return null;
  const ratio = actual / target;

  if (mode === 'near') {
    return ratio >= 0.90 && ratio <= 1.10;
  }
  return ratio >= 0.90;
}

export function isCalorieMet(consumed: number, budget: number): boolean | null {
  if (!consumed || !budget) return null;
  const band = Math.max(budget * CALORIE_BAND_RATIO, CALORIE_BAND_FLOOR);
  return Math.abs(consumed - budget) <= band;
}

export type MetricSlotStatus = 'met' | 'partial' | 'missed' | 'no-data';

/** Insights display bands — partial is wider than met but uses the same met core. */
export function getCalorieMetricStatus(
  consumed: number,
  budget: number,
): MetricSlotStatus {
  const met = isCalorieMet(consumed, budget);
  if (met === null) return 'no-data';
  if (met) return 'met';
  const partialBand = Math.max(budget * 0.15, 200);
  if (Math.abs(consumed - budget) <= partialBand) return 'partial';
  return 'missed';
}

export function getAtLeastMetricStatus(
  actual: number | null,
  target: number | null,
): MetricSlotStatus {
  const met = isMetricMet(actual, target, 'at_least');
  if (met === null) return 'no-data';
  if (met) return 'met';
  if (actual != null && target != null && target > 0 && actual / target >= 0.70) {
    return 'partial';
  }
  return 'missed';
}

export interface MetricDayInput {
  date: string;
  calories_consumed: number;
  protein_consumed: number;
  calorie_budget: number;
  protein_target?: number | null;
  steps: number | null;
  sleep_hours: number | null;
}

export interface MetricTargetsConfig {
  profileCalorieBudget: number;
  profileProteinTarget: number;
  steps: number;
  sleep: number;
}

export interface DaySlot {
  metric: 'calories' | 'protein' | 'steps' | 'sleep';
  met: boolean;
}

export interface DayProgressFlag {
  date: string;
  met: boolean;
  logged: boolean;
}

export interface WeeklyProgressResult {
  consistency_score: number;
  goals_hit: number;
  days: DayProgressFlag[];
}

export function buildMetricTargetsConfig(from: {
  calorie_budget?: number | null;
  protein_target?: number | null;
  steps_target?: number | null;
  sleep_target?: number | null;
}): MetricTargetsConfig {
  return {
    profileCalorieBudget: from.calorie_budget ?? 0,
    profileProteinTarget: from.protein_target ?? 0,
    steps: from.steps_target ?? DEFAULT_STEPS_TARGET,
    sleep: from.sleep_target ?? DEFAULT_SLEEP_TARGET,
  };
}

function dayCalorieBudget(day: MetricDayInput, profileBudget: number): number {
  return day.calorie_budget > 0 ? day.calorie_budget : profileBudget;
}

function dayProteinTarget(day: MetricDayInput, profileProtein: number): number {
  const snap = day.protein_target ?? 0;
  return snap > 0 ? snap : profileProtein;
}

export function computeDaySlots(
  day: MetricDayInput,
  targets: MetricTargetsConfig,
): DaySlot[] {
  const slots: DaySlot[] = [];

  if (day.calories_consumed > 0) {
    const budget = dayCalorieBudget(day, targets.profileCalorieBudget);
    const met = isCalorieMet(day.calories_consumed, budget);
    if (met !== null) {
      slots.push({ metric: 'calories', met });
    }
  }

  const proteinTarget = dayProteinTarget(day, targets.profileProteinTarget);
  const proteinMet = isMetricMet(day.protein_consumed, proteinTarget, 'at_least');
  if (proteinMet !== null) {
    slots.push({ metric: 'protein', met: proteinMet });
  }

  const stepsMet = isMetricMet(day.steps, targets.steps, 'at_least');
  if (stepsMet !== null) {
    slots.push({ metric: 'steps', met: stepsMet });
  }

  const sleepMet = isMetricMet(day.sleep_hours, targets.sleep, 'at_least');
  if (sleepMet !== null) {
    slots.push({ metric: 'sleep', met: sleepMet });
  }

  return slots;
}

/** Fraction of applicable slots met on a logged day (0 when not logged). */
export function dayMetRatio(
  day: MetricDayInput,
  targets: MetricTargetsConfig,
): number {
  if (day.calories_consumed <= 0) return 0;
  const slots = computeDaySlots(day, targets);
  if (slots.length === 0) return 0;
  return slots.filter((s) => s.met).length / slots.length;
}

export function computeWeeklyProgress(
  weekDays: MetricDayInput[],
  targets: MetricTargetsConfig,
): WeeklyProgressResult {
  let totalSlots = 0;
  let metSlots = 0;
  let goalsHit = 0;
  const dayFlags: DayProgressFlag[] = [];

  for (const day of weekDays) {
    if (day.calories_consumed <= 0) {
      dayFlags.push({ date: day.date, met: false, logged: false });
      continue;
    }

    const slots = computeDaySlots(day, targets);
    const dayMetCount = slots.filter((s) => s.met).length;
    const dayTotal = slots.length;

    totalSlots += dayTotal;
    metSlots += dayMetCount;

    const dayScore = dayTotal > 0 ? dayMetCount / dayTotal : 0;
    const onTarget = dayScore >= DAY_MET_THRESHOLD;
    if (onTarget) goalsHit++;

    dayFlags.push({ date: day.date, met: onTarget, logged: true });
  }

  return {
    consistency_score:
      totalSlots > 0 ? Math.round((metSlots / totalSlots) * 100) : 0,
    goals_hit: goalsHit,
    days: dayFlags,
  };
}

/** Consecutive food-logging days, walking backward from anchorDate (YYYY-MM-DD). */
export function computeLoggingStreak(
  loggedDates: Set<string>,
  anchorDate: string,
): number {
  let cursor = anchorDate;
  if (!loggedDates.has(cursor)) {
    cursor = addLocalCalendarDays(cursor, -1);
  }

  let streak = 0;
  while (loggedDates.has(cursor)) {
    streak++;
    cursor = addLocalCalendarDays(cursor, -1);
  }
  return streak;
}
