import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import type { UserProfile } from '@/context/auth-context'
import { apiFetch } from '@/utils/api'
import {
  apiWeeklyToSummary,
  getWeekStart,
  recomputeNormalizedDay,
  type InsightTargets,
  type NormalizedDay,
  type WeeklyInsightSummary,
} from '@/utils/insights-aggregator'
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
import {
  buildWeekKey,
  getCached,
  setCached,
  invalidateWeek,
  TTL_CURRENT_WEEK,
  TTL_PAST_WEEK,
} from '@/utils/insights-cache'

interface UseWeeklyInsightsResult {
  data:         WeeklyInsightSummary | null
  isLoading:    boolean
  isRefreshing: boolean
  isStale:      boolean
  error:        string | null
  refresh:      () => Promise<void>
}

export function useWeeklyInsights(weekStart?: string): UseWeeklyInsightsResult {
  const { user } = useAuth()
  const week     = weekStart ?? getWeekStart()
  const isCurrentWeek = week === getWeekStart()

  const [data,         setData]         = useState<WeeklyInsightSummary | null>(null)
  const [isLoading,    setIsLoading]    = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isStale,      setIsStale]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Prevent stale async operations from updating state after unmount or week change
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchFromServer = useCallback(async (local: LocalTargets): Promise<WeeklyInsightSummary> => {
    const [summaryRes, insightRes] = await Promise.all([
      apiFetch(`/summary/weekly?weekStart=${week}`).then(r => ({ status: 'fulfilled' as const, value: r })).catch(e => ({ status: 'rejected' as const, reason: e })),
      apiFetch(`/insights/weekly?weekStart=${week}`).then(r => ({ status: 'fulfilled' as const, value: r })).catch(e => ({ status: 'rejected' as const, reason: e })),
    ])

    if (summaryRes.status === 'rejected' || !summaryRes.value.ok) {
      throw new Error('Failed to load weekly summary')
    }

    const insightMessage =
      insightRes.status === 'fulfilled' && insightRes.value.ok
        ? (insightRes.value.body as any)?.insight?.message ?? null
        : null

    const apiData = summaryRes.value.body as Record<string, any>
    const snapshot = (apiData.targets_snapshot ?? {}) as Partial<InsightTargets>
    const fallbackProtein = deriveProteinTarget(user)
    apiData.targets_snapshot = ensureValidTargets(
      {
        calorie_budget: snapshot.calorie_budget ?? DEFAULT_CALORIE_BUDGET,
        protein_target: snapshot.protein_target ?? DEFAULT_PROTEIN_TARGET,
        steps_target:   local.steps_target ?? snapshot.steps_target ?? user?.stepsTarget ?? 10000,
        sleep_target:   local.sleep_target ?? snapshot.sleep_target ?? null,
      },
      fallbackProtein,
    )

    return apiWeeklyToSummary(apiData, insightMessage)
  }, [week, user])

  // Always re-derive each day on cache reads so stale `score` / `met_*` values
  // baked in by older code paths self-heal under the current scoring rules.
  const applyDerivedTargets = useCallback(
    (d: WeeklyInsightSummary, local: LocalTargets): WeeklyInsightSummary => {
      const fallbackProtein = deriveProteinTarget(user)
      const merged: InsightTargets = {
        ...d.targets_snapshot,
        steps_target: local.steps_target ?? d.targets_snapshot.steps_target ?? user?.stepsTarget ?? 10000,
        sleep_target: local.sleep_target ?? d.targets_snapshot.sleep_target,
      }
      const targets = ensureValidTargets(merged, fallbackProtein)
      const days: NormalizedDay[] = d.days.map(day => recomputeNormalizedDay(day, targets))
      const logged = days.filter(x => !x.is_partial)
      return {
        ...d,
        targets_snapshot:  targets,
        days,
        days_met_calories: logged.filter(x => x.met_calories === 'met').length,
        days_met_protein:  logged.filter(x => x.met_protein  === 'met').length,
        days_met_steps:    logged.filter(x => x.met_steps    === 'met').length,
        days_met_sleep:    logged.filter(x => x.met_sleep    === 'met').length,
      }
    },
    [user],
  )

  const load = useCallback(async (background = false) => {
    if (!user?.id) return

    const cacheKey = buildWeekKey(user.id, week)
    const ttl      = isCurrentWeek ? TTL_CURRENT_WEEK : TTL_PAST_WEEK
    const local    = await getLocalTargets()

    if (!background) {
      const cached = await getCached<WeeklyInsightSummary>(cacheKey)
      if (cached) {
        if (mountedRef.current) {
          setData(applyDerivedTargets(cached.data, local))
          setIsLoading(false)
          setError(null)
        }
        if (!cached.isStale) return
        if (mountedRef.current) setIsStale(true)
        // Fall through to revalidate in background
      }
    }

    try {
      const fresh = await fetchFromServer(local)
      await setCached(cacheKey, fresh, ttl)
      if (mountedRef.current) {
        setData(fresh)
        setIsStale(false)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current && !data) {
        setError('Could not load weekly insights. Pull down to retry.')
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [user?.id, week, isCurrentWeek, fetchFromServer, applyDerivedTargets, data])

  // Reload when week or user changes
  useEffect(() => {
    setIsLoading(true)
    setData(null)
    setError(null)
    setIsStale(false)
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, user?.id])

  const refresh = useCallback(async () => {
    if (!user?.id) return
    setIsRefreshing(true)
    await invalidateWeek(user.id, week)
    await load(true)
  }, [user?.id, week, load])

  return { data, isLoading, isRefreshing, isStale, error, refresh }
}
