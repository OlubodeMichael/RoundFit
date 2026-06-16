import type { Workout } from '@/context/workout-context';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';

export function workoutDay(w: Workout): string {
  return w.date
    ?? (w.started_at
      ? getLocalDateString(new Date(w.started_at))
      : w.created_at.slice(0, 10));
}

/**
 * Consecutive hard-training days ending yesterday. Two hard days back to back is
 * a real recovery risk; three or more should bias toward rest.
 */
export function countConsecutiveHardDays(workouts: Workout[]): number {
  const today = getLocalDateString();
  let streak = 0;
  for (let i = 1; i <= 7; i++) {
    const d = addLocalCalendarDays(today, -i);
    const hard = workouts.some((w) => workoutDay(w) === d && w.intensity === 'hard');
    if (!hard) break;
    streak += 1;
  }
  return streak;
}
