import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { WorkoutIntensity, WorkoutSource, DistanceUnit, Workout } from '@/context/workout-context';
import type { WorkoutImportReviewItem } from '@/services/workout-import';
import {
  addLocalCalendarDays,
  formatDeviceLocalTime,
  formatDeviceLocalTimeRange,
  formatMonthDayLocal,
  getLocalDateString,
  localWeekdayShort,
} from '@/utils/date';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const WORKOUT_META: Record<string, { icon: IoniconName; label: string }> = {
  gym: { icon: 'barbell-outline', label: 'Strength' },
  running: { icon: 'footsteps-outline', label: 'Running' },
  cycling: { icon: 'bicycle-outline', label: 'Cycling' },
  hiit: { icon: 'flash-outline', label: 'HIIT' },
  yoga: { icon: 'leaf-outline', label: 'Yoga' },
  swimming: { icon: 'water-outline', label: 'Swimming' },
  walking: { icon: 'footsteps-outline', label: 'Walking' },
  rowing: { icon: 'boat-outline', label: 'Rowing' },
  elliptical: { icon: 'reload-outline', label: 'Elliptical' },
  other: { icon: 'apps-outline', label: 'Workout' },
};

export function fmtWorkoutDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Minutes from a HealthKit sample not yet saved to RoundFit. */
export function pendingWorkoutDurationMinutes(item: WorkoutImportReviewItem): number {
  return item.durationMinutes > 0
    ? item.durationMinutes
    : Math.max(1, Math.round(item.sample.durationSeconds / 60));
}

/**
 * Saved workouts for the day plus unsaved Apple Fitness workouts (same local day).
 * Avoids double-counting: pending list already excludes rows imported via `healthkit_uuid`.
 */
export function sumTodayWorkoutDurationMinutes(
  savedWorkouts: readonly Workout[],
  pendingItems: readonly WorkoutImportReviewItem[],
  todayKey: string = getLocalDateString(),
): number {
  const savedMins = savedWorkouts.reduce((sum, w) => sum + (w.duration_mins ?? 0), 0);
  const pendingMins = pendingItems
    .filter((item) => getLocalDateString(item.sample.startDate) === todayKey)
    .reduce((sum, item) => sum + pendingWorkoutDurationMinutes(item), 0);
  return savedMins + pendingMins;
}

export function sumTodayWorkoutCalories(
  savedWorkouts: readonly Workout[],
  pendingItems: readonly WorkoutImportReviewItem[],
  savedCaloriesBurned: number,
  todayKey: string = getLocalDateString(),
): number {
  const pendingCals = pendingItems
    .filter((item) => getLocalDateString(item.sample.startDate) === todayKey)
    .reduce((sum, item) => sum + (item.caloriesBurned ?? 0), 0);
  return savedCaloriesBurned + pendingCals;
}

export function countTodayWorkoutSessions(
  savedWorkouts: readonly Workout[],
  pendingItems: readonly WorkoutImportReviewItem[],
  todayKey: string = getLocalDateString(),
): number {
  const pendingToday = pendingItems.filter(
    (item) => getLocalDateString(item.sample.startDate) === todayKey,
  ).length;
  return savedWorkouts.length + pendingToday;
}

/** Apple Fitness / HealthKit source badge heart color. */
export const APPLE_FITNESS_HEART_COLOR = '#FF2D55';

export function workoutSourceLabel(source: WorkoutSource): string | null {
  if (source === 'healthkit') return 'Apple Fitness';
  if (source === 'googlefit') return 'Google Fit';
  return null;
}

export function formatHistoryDateLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === addLocalCalendarDays(todayKey, -1)) return 'Yesterday';
  const iso = `${dateKey}T12:00:00`;
  const weekday = localWeekdayShort(iso);
  const monthDay = formatMonthDayLocal(iso);
  return weekday ? `${weekday}, ${monthDay}` : monthDay;
}

export const INTENSITY_LABEL: Record<WorkoutIntensity, string> = {
  light: 'Light',
  moderate: 'Moderate',
  hard: 'Hard',
};

/** @deprecated Use `formatDeviceLocalTime` from `@/utils/date`. */
export const formatWorkoutTime = formatDeviceLocalTime;

/** @deprecated Use `formatDeviceLocalTimeRange` from `@/utils/date`. */
export const formatWorkoutTimeRange = formatDeviceLocalTimeRange;

export function formatWorkoutDistance(
  distance?: number,
  unit: DistanceUnit = 'km',
): string | null {
  if (distance == null || distance <= 0) return null;
  const label = unit === 'miles' ? 'mi' : 'km';
  const value = distance >= 10 ? Math.round(distance) : Math.round(distance * 10) / 10;
  return `${value} ${label}`;
}

export function workoutFooterLabel(source: WorkoutSource): string {
  if (source === 'healthkit') return 'Imported from Apple Fitness';
  if (source === 'googlefit') return 'Imported from Google Fit';
  return 'Logged manually';
}
