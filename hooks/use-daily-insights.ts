import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import type { UserProfile } from '@/context/auth-context'
import { apiFetch } from '@/utils/api'
import {
  apiDayToNormalized,
  recomputeNormalizedDay,
  type DailyInsightSummary,
  type InsightTargets,
} from '@/utils/insights-aggregator'
import {
  buildDayKey,
  getCached,
  setCached,
  invalidateDay,
  TTL_CURRENT_DAY,
  TTL_PAST_DAY,
} from '@/utils/insights-cache'
import { getLocalDateString } from '@/utils/date'
import { getLocalTargets, type LocalTargets } from '@/utils/local-targets'
import { calculateMacros } from '@/utils/nutrition'

const DEFAULT_CALORIE_BUDGET = 2000
const DEFAULT_PROTEIN_TARGET = 150

/**
 * Fallback protein target (g/day) derived from the user's profile, used only
 * when the server omits or returns an invalid `protein_target`. Mirrors the
 * macro plan used on the home screen so both views stay in sync.
 */
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
  const isToday   = targetDate === today

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

  const fetchFromServer = useCallback(async (local: LocalTargets): Promise<DailyInsightSummary> => {
    const { ok, body } = await apiFetch(`/summary/daily/${targetDate}`)
    if (!ok) throw new Error('Failed to load daily summary')

    const b = body as Record<string, any>
    const serverTargets: InsightTargets = b.targets ?? {
      calorie_budget: DEFAULT_CALORIE_BUDGET,
      protein_target: DEFAULT_PROTEIN_TARGET,
      steps_target:   null,
      sleep_target:   null,
    }
    const fallbackProtein = deriveProteinTarget(user)
    const merged: InsightTargets = {
      ...serverTargets,
      steps_target: local.steps_target ?? serverTargets.steps_target,
      sleep_target: local.sleep_target ?? serverTargets.sleep_target,
    }
    const targets = ensureValidTargets(merged, fallbackProtein)

    return {
      day:              apiDayToNormalized(b.summary, targets),
      targets,
      last_computed_at: b.computed_at ?? new Date().toISOString(),
    }
  }, [targetDate, user])

  // Always re-derive the day on cache reads so stale `score` / `met_*` values
  // baked in by older code paths self-heal under the current scoring rules.
  // The recompute is a pure, cheap transform — no need to micro-optimise.
  const applyDerivedTargets = useCallback(
    (d: DailyInsightSummary, local: LocalTargets): DailyInsightSummary => {
      const fallbackProtein = deriveProteinTarget(user)
      const merged: InsightTargets = {
        ...d.targets,
        steps_target: local.steps_target ?? d.targets.steps_target,
        sleep_target: local.sleep_target ?? d.targets.sleep_target,
      }
      const targets = ensureValidTargets(merged, fallbackProtein)
      return { ...d, targets, day: recomputeNormalizedDay(d.day, targets) }
    },
    [user],
  )

  const load = useCallback(async (background = false) => {
    if (!user?.id) return

    const cacheKey = buildDayKey(user.id, targetDate)
    const ttl      = isToday ? TTL_CURRENT_DAY : TTL_PAST_DAY
    const local    = await getLocalTargets()

    if (!background) {
      const cached = await getCached<DailyInsightSummary>(cacheKey)
      if (cached) {
        if (mountedRef.current) {
          setData(applyDerivedTargets(cached.data, local))
          setIsLoading(false)
          setError(null)
        }
        // Past days don't change once written — stop here when the cache is
        // still warm. Today is special: a meal could have been logged on the
        // server since this cache entry was written, so always fall through
        // and background-revalidate so the score reflects the latest data.
        if (!isToday && !cached.isStale) return
        if (mountedRef.current && cached.isStale) setIsStale(true)
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
        setError('Could not load daily insights. Pull down to retry.')
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [user?.id, targetDate, isToday, fetchFromServer, applyDerivedTargets, data])

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
    await invalidateDay(user.id, targetDate)
    await load(true)
  }, [user?.id, targetDate, load])

  return { data, isLoading, isRefreshing, isStale, error, refresh }
}
