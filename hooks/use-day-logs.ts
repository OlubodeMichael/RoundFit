import { useCallback, useEffect, useState } from 'react'

import type { MealItem } from '@/context/food-context'
import type { Workout } from '@/context/workout-context'
import { useFood } from '@/hooks/use-food'
import { useWorkouts } from '@/context/workout-context'
import { getLocalDateString } from '@/utils/date'

interface UseDayLogsResult {
  meals: MealItem[]
  workouts: Workout[]
  isLoading: boolean
  refresh: () => Promise<void>
}

/** Past-day meals + workouts via shared resource cache (no home day_cache). */
export function useDayLogs(date: string): UseDayLogsResult {
  const today = getLocalDateString()
  const isToday = date === today
  const { meals: todayMeals, fetchForDate: fetchMealsForDate } = useFood()
  const { workouts: todayWorkouts, fetchForDate: fetchWorkoutsForDate } = useWorkouts()

  const [meals, setMeals] = useState<MealItem[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [isLoading, setIsLoading] = useState(!isToday)

  const load = useCallback(async (force = false) => {
    if (isToday) return
    setIsLoading(true)
    try {
      const [m, w] = await Promise.all([
        fetchMealsForDate(date, force),
        fetchWorkoutsForDate(date, force),
      ])
      setMeals(m)
      setWorkouts(w)
    } finally {
      setIsLoading(false)
    }
  }, [date, isToday, fetchMealsForDate, fetchWorkoutsForDate])

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
      isLoading: false,
      refresh: async () => {},
    }
  }

  return { meals, workouts, isLoading, refresh }
}
