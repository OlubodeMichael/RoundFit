import { useCallback, useEffect, useState } from 'react'

import type { MealItem } from '@/context/food-context'
import type { Workout } from '@/context/workout-context'
import { useAuth } from '@/hooks/use-auth'
import { useFood } from '@/hooks/use-food'
import { useWorkouts } from '@/context/workout-context'
import { fetchDailySummaryBundle } from '@/utils/daily-summary-cache'
import { getLocalDateString } from '@/utils/date'

interface UseDayLogsResult {
  meals: MealItem[]
  workouts: Workout[]
  /**
   * The day's calories_burned from the daily summary (HealthKit active
   * calories when synced, else check-in burn). Null for today (callers use
   * live health data) and when no summary exists for the day. Keeps past-day
   * burn on the same "active calories" basis as today's live value — summing
   * workout calories alone under-reports and makes Net incomparable across
   * days.
   */
  caloriesBurned: number | null
  isLoading: boolean
  refresh: () => Promise<void>
}

/** Past-day meals + workouts via shared resource cache (no home day_cache). */
export function useDayLogs(date: string): UseDayLogsResult {
  const today = getLocalDateString()
  const isToday = date === today
  const { user } = useAuth()
  const { meals: todayMeals, fetchForDate: fetchMealsForDate } = useFood()
  const { workouts: todayWorkouts, fetchForDate: fetchWorkoutsForDate } = useWorkouts()

  const [meals, setMeals] = useState<MealItem[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [caloriesBurned, setCaloriesBurned] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(!isToday)

  const userId = user?.id

  const load = useCallback(async (force = false) => {
    if (isToday) return
    setIsLoading(true)
    try {
      const [m, w, bundle] = await Promise.all([
        fetchMealsForDate(date, force),
        fetchWorkoutsForDate(date, force),
        userId
          ? fetchDailySummaryBundle(userId, date, { force }).catch(() => null)
          : Promise.resolve(null),
      ])
      setMeals(m)
      setWorkouts(w)
      setCaloriesBurned(
        bundle && bundle.daily.calories_burned > 0
          ? bundle.daily.calories_burned
          : null,
      )
    } finally {
      setIsLoading(false)
    }
  }, [date, isToday, userId, fetchMealsForDate, fetchWorkoutsForDate])

  useEffect(() => {
    if (isToday) return
    void load(false)
  }, [isToday, load])

  const refresh = useCallback(async () => {
    await load(true)
  }, [load])

  if (isToday) {
    return {
      meals: todayMeals,
      workouts: todayWorkouts,
      caloriesBurned: null,
      isLoading: false,
      refresh: async () => {},
    }
  }

  return { meals, workouts, caloriesBurned, isLoading, refresh }
}
