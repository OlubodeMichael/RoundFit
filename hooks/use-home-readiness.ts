import { useMemo } from 'react'

import { useAuth } from '@/context/auth-context'
import { useCheckin } from '@/context/checkin-context'
import { useCycle } from '@/context/cycle-context'
import type { RecoveryDisplay } from '@/context/recovery-context'
import { useHealth } from '@/context/health-context'
import { useSummary } from '@/context/summary-context'
import { useWorkouts } from '@/context/workout-context'
import { buildReadinessInput } from '@/utils/build-readiness-input'
import { calculateMacros } from '@/utils/nutrition'
import { computeReadiness } from '@/utils/readiness'

const EMPTY_DISPLAY: RecoveryDisplay = {
  score:          null,
  recommendation: null,
  reason:         null,
  sleepScore:     null,
  strainScore:    null,
  factors:        [],
  tips:           [],
  trend7d:        [],
  trend30d:       [],
}

/**
 * Client-side readiness for Home — uses data already loaded by Food, Health,
 * Check-in, Summary, and Workout contexts. No recovery API bundle.
 */
export function useHomeReadiness(): RecoveryDisplay {
  const { status, user } = useAuth()
  const { today: healthToday } = useHealth()
  const { today: checkinToday } = useCheckin()
  const { current: cycle } = useCycle()
  const { daily: summaryToday } = useSummary()
  const { workouts } = useWorkouts()

  const proteinTarget = useMemo(() => {
    if (!user) return 150
    try {
      return calculateMacros({
        sex:           user.sex,
        age:           user.age,
        heightCm:      user.heightCm,
        weightKg:      user.weightKg,
        activityLevel: user.activityLevel,
        goal:          user.goal,
      }).proteinG
    } catch {
      return 150
    }
  }, [user])

  const calorieBudget = user?.calorieBudget ?? user?.tdee ?? 2000

  return useMemo(() => {
    if (status !== 'authenticated') return EMPTY_DISPLAY

    const input = buildReadinessInput({
      recoveryLog:         null,
      healthToday,
      checkinToday,
      cycle,
      userSex:             user?.sex ?? 'male',
      yesterdaySummary:    summaryToday,
      workouts7d:          workouts,
      hrvBaseline:         null,
      restingHrBaseline:   null,
      proteinTarget,
      calorieBudget,
    })

    const computed = computeReadiness(input)
    if (!computed) return EMPTY_DISPLAY

    return {
      score:          computed.score,
      recommendation: computed.recommendation,
      reason:         computed.reason,
      sleepScore:     computed.sleep_score,
      strainScore:    computed.strain_score,
      factors:        computed.factors,
      tips:           computed.tips,
      trend7d:        [],
      trend30d:       [],
    }
  }, [
    status,
    healthToday,
    checkinToday,
    cycle,
    user?.sex,
    summaryToday,
    workouts,
    proteinTarget,
    calorieBudget,
  ])
}
