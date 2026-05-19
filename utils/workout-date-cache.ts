import type { Workout } from '@/context/workout-context'
import { getLocalDateString } from '@/utils/date'
import { TTL_COLD_START_MS } from '@/utils/daily-summary-cache'

const mem = new Map<string, { workouts: Workout[]; expiresAt: number }>()

export function getCachedWorkouts(date: string): Workout[] | null {
  const entry = mem.get(date)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    mem.delete(date)
    return null
  }
  return entry.workouts
}

export function setCachedWorkouts(date: string, workouts: Workout[]): void {
  mem.set(date, { workouts, expiresAt: Date.now() + TTL_COLD_START_MS })
}

export function invalidateWorkoutDate(date: string): void {
  mem.delete(date)
}

export function invalidateWorkoutToday(): void {
  invalidateWorkoutDate(getLocalDateString())
}
