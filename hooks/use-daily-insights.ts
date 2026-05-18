import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import type { UserProfile } from '@/context/auth-context'
import {
  apiDayToNormalized,
  recomputeNormalizedDay,
  type DailyInsightSummary,
  type InsightTargets,
} from '@/utils/insights-aggregator'
import {
  fetchDailySummaryBundle,
  invalidateUserDayCaches,
} from '@/utils/daily-summary-cache'
import { getLocalDateString } from '@/utils/date'
import { getLocalTargets, type LocalTargets } from '@/utils/local-targets'
import { calculateMacros } from '@/utils/nutrition'

const DEFAULT_CALORIE_BUDGET = 2000
const DEFAULT_PROTEIN_TARGET = 150

function deriveProteinTarget(user: UserProfile | null | undefined): number {
  if (!user) return DEFAULT_PROTEIN_TARGET
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
    return DEFAULT_PROTEIN_TARGET
  }
}

function ensureValidTargets(t: InsightTargets, fallbackProtein: number): InsightTargets {
  return {
    ...t,
    calorie_budget: t.calorie_budget > 0 ? t.calorie_budget : DEFAULT_CALORIE_BUDGET,
    protein_target: t.protein_target > 0 ? t.protein_target : fallbackProtein,
  }
}

interface UseDailyInsightsResult {
  data:         DailyInsightSummary | null
  isLoading:    boolean
  isRefreshing: boolean
  isStale:      boolean
  error:        string | null
  refresh:      () => Promise<void>
}

export function useDailyInsights(date?: string): UseDailyInsightsResult {
  const { user }  = useAuth()
  const today     = getLocalDateString()
  const targetDate = date ?? today

  const [data,         setData]         = useState<DailyInsightSummary | null>(null)
  const [isLoading,    setIsLoading]    = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isStale,      setIsStale]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const bundleToInsight = useCallback(
    async (local: LocalTargets, force = false): Promise<DailyInsightSummary | null> => {
      if (!user?.id) return null

      const bundle = await fetchDailySummaryBundle(user.id, targetDate, { force })
      if (!bundle) return null

      const serverTargets: InsightTargets = bundle.targets ?? {
        calorie_budget: DEFAULT_CALORIE_BUDGET,
        protein_target: DEFAULT_PROTEIN_TARGET,
        steps_target:   null,
        sleep_target:   null,
      }
      const fallbackProtein = deriveProteinTarget(user)
      const merged: InsightTargets = {
        ...serverTargets,
        steps_target: local.steps_target ?? serverTargets.steps_target ?? user?.stepsTarget ?? 10000,
        sleep_target: local.sleep_target ?? serverTargets.sleep_target,
      }
      const targets = ensureValidTargets(merged, fallbackProtein)

      return {
        day:              apiDayToNormalized(bundle.raw, targets),
        targets,
        last_computed_at: bundle.computed_at,
      }
    },
    [targetDate, user],
  )

  const applyDerivedTargets = useCallback(
    (d: DailyInsightSummary, local: LocalTargets): DailyInsightSummary => {
      const fallbackProtein = deriveProteinTarget(user)
      const merged: InsightTargets = {
        ...d.targets,
        steps_target: local.steps_target ?? d.targets.steps_target ?? user?.stepsTarget ?? 10000,
        sleep_target: local.sleep_target ?? d.targets.sleep_target,
      }
      const targets = ensureValidTargets(merged, fallbackProtein)
      return { ...d, targets, day: recomputeNormalizedDay(d.day, targets) }
    },
    [user],
  )

  const load = useCallback(async (options?: { force?: boolean }) => {
    if (!user?.id) return

    const local = await getLocalTargets()

    try {
      const fresh = await bundleToInsight(local, options?.force)
      if (!fresh) throw new Error('Failed to load daily summary')

      if (mountedRef.current) {
        setData(applyDerivedTargets(fresh, local))
        setIsStale(false)
        setError(null)
      }
    } catch {
      if (mountedRef.current && !data) {
        setError('Could not load daily insights. Pull down to retry.')
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [user?.id, bundleToInsight, applyDerivedTargets, data])

  useEffect(() => {
    setIsLoading(true)
    setData(null)
    setError(null)
    setIsStale(false)
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, user?.id])

  const refresh = useCallback(async () => {
    if (!user?.id) return
    setIsRefreshing(true)
    await invalidateUserDayCaches(user.id, targetDate)
    await load({ force: true })
  }, [user?.id, targetDate, load])

  return { data, isLoading, isRefreshing, isStale, error, refresh }
}
