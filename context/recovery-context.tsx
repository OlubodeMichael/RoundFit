import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { useCheckin } from '@/context/checkin-context';
import { useCycle } from '@/context/cycle-context';
import { useHealth } from '@/context/health-context';
import type { DailySummary } from '@/context/summary-context';
import { useSummary } from '@/context/summary-context';
import { useWorkouts } from '@/context/workout-context';
import type { Workout } from '@/context/workout-context';
import type { ComputedReadiness, ReadinessFactor, ReadinessHistoryPoint, ReadinessTip } from '@/types/readiness';
import { buildReadinessInput, datesPrior7 } from '@/utils/build-readiness-input';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import { localSleepDateString } from '@/utils/sleep-date';
import { computeBaseline } from '@/utils/baseline';
import { computeStepsBaseline, type StepDayInput } from '@/utils/infer-soreness';
import { mergePriorDaySleepIntoRecovery } from '@/utils/sleep-display';
import { calculateMacros } from '@/utils/nutrition';
import {
  buildReadinessTrend,
  computeReadiness,
  computeTrendDirection,
} from '@/utils/readiness';
import { apiFetch } from '@/utils/api';
import { fetchDailySummaryBundle, TTL_COLD_START_MS } from '@/utils/daily-summary-cache';
import { notifyTodayDataChanged, registerTodayDataSyncListener } from '@/utils/today-sync';
import { applyHealthReconcile } from '@/utils/today-health-reconcile';
import { shouldRefetchRecoveryAfterMutation } from '@/utils/cache-invalidation';
import {
  applyInsightsMetricsPatch,
  writeThroughInsightsDayMetrics,
} from '@/utils/insights-metrics-patch';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  setResourceCached,
  invalidateResourceCache,
  ttlForDate,
} from '@/utils/resource-cache';

const TTL_BASELINES = 4 * 60 * 60 * 1000; // 30-day history: 4-hour TTL

// ── Types ──────────────────────────────────────────────────────────────────

export type SleepQuality    = 'poor' | 'fair' | 'good';
export type RecoverySource  = 'healthkit' | 'googlefit' | 'manual';
export type ReadinessRec    = 'Rest' | 'Light workout' | 'Moderate' | 'Train hard';

export interface RecoveryLog {
  id:                  string;
  sleep_hours:         number | null;
  sleep_quality:       SleepQuality | null;
  sleep_score:         number | null;
  deep_sleep_hours:    number | null;
  rem_sleep_hours:     number | null;
  resting_heart_rate:  number | null;
  hrv:                 number | null;
  soreness_level:      number | null;
  notes:               string | null;
  source:              RecoverySource | null;
  recorded_at:         string;
}

export interface Readiness {
  score:          number;
  recommendation: ReadinessRec;
  reason:         string | null;
  created_at:     string;
}

export interface LogRecoveryInput {
  sleep_hours?:        number;
  sleep_quality?:      SleepQuality;
  sleep_score?:        number;
  deep_sleep_hours?:   number;
  rem_sleep_hours?:    number;
  resting_heart_rate?: number;
  hrv?:                number;
  soreness_level?:     number;
  notes?:              string;
  source?:             RecoverySource;
  date?:               string;
  bedtime_iso?:        string;
  wakeup_iso?:         string;
}

export interface RecoveryDisplay {
  score:          number | null;
  recommendation: ReadinessRec | null;
  reason:         string | null;
  sleepScore:     number | null;
  strainScore:    number | null;
  factors:        ReadinessFactor[];
  tips:           ReadinessTip[];
  trend7d:        ReadinessHistoryPoint[];
  trend30d:       ReadinessHistoryPoint[];
}

export interface RecoveryContextValue {
  today: RecoveryLog | null;
  readiness: Readiness | null;
  computed: ComputedReadiness | null;
  display: RecoveryDisplay;
  isLoading: boolean;
  initialized: boolean;
  hasInsufficientData: boolean;
  hrvBaseline: number | null;
  restingHrBaseline: number | null;
  logRecovery: (input: LogRecoveryInput, options?: { notifyListeners?: boolean }) => Promise<RecoveryLog>;
  /** Recovery log for a wake-up calendar day (sleep log date picker). */
  fetchRecoveryByDate: (date: string, force?: boolean) => Promise<RecoveryLog | null>;
  /** Loads recovery bundle; uses AsyncStorage unless `force` is true. */
  refresh: (options?: { force?: boolean }) => Promise<void>;
}

// ── Normalisation helpers ──────────────────────────────────────────────────

function nullableNum(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function nullableStr<T extends string>(v: unknown): T | null {
  return typeof v === 'string' ? (v as T) : null;
}

function fromApiLog(row: Record<string, unknown>): RecoveryLog {
  return {
    id:                 String(row.id ?? ''),
    sleep_hours:        nullableNum(row.sleep_hours),
    sleep_quality:      nullableStr<SleepQuality>(row.sleep_quality),
    sleep_score:        nullableNum(row.sleep_score),
    deep_sleep_hours:   nullableNum(row.deep_sleep_hours),
    rem_sleep_hours:    nullableNum(row.rem_sleep_hours),
    resting_heart_rate: nullableNum(row.resting_heart_rate),
    hrv:                nullableNum(row.hrv),
    soreness_level:     nullableNum(row.soreness_level),
    notes:              nullableStr(row.notes),
    source:             nullableStr<RecoverySource>(row.source),
    recorded_at:        typeof row.recorded_at === 'string' ? row.recorded_at : new Date().toISOString(),
  };
}

function fromApiReadiness(row: Record<string, unknown>): Readiness {
  return {
    score:          typeof row.score === 'number' ? row.score : 0,
    recommendation: (row.recommendation as ReadinessRec) ?? 'Moderate',
    reason:         nullableStr(row.reason),
    created_at:     typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

function datesLast7(): string[] {
  const today = getLocalDateString();
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    out.push(addLocalCalendarDays(today, -i));
  }
  return out;
}

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
};

// ── Context ────────────────────────────────────────────────────────────────

const RecoveryContext = createContext<RecoveryContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function RecoveryProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const { today: healthToday, fetchForDate: fetchHealthForDate } = useHealth();
  const { today: checkinToday } = useCheckin();
  const { current: cycle } = useCycle();
  const { daily: summaryToday } = useSummary();
  const { workouts: todayWorkouts, fetchForDate: fetchWorkoutsForDate } = useWorkouts();

  const [today,           setToday]           = useState<RecoveryLog | null>(null);
  const [readiness,       setReadiness]       = useState<Readiness | null>(null);
  const [isLoading,       setIsLoading]       = useState(false);
  const [initialized,     setInitialized]     = useState(false);
  const [workouts7d,      setWorkouts7d]      = useState<Workout[]>([]);
  const [workoutsPrior7d, setWorkoutsPrior7d] = useState<Workout[]>([]);
  const [yesterdaySummary, setYesterdaySummary] = useState<DailySummary | null>(null);
  const [dayBeforeSummary, setDayBeforeSummary] = useState<DailySummary | null>(null);
  const [hrvBaseline,     setHrvBaseline]     = useState<number | null>(null);
  const [restingHrBaseline, setRestingHrBaseline] = useState<number | null>(null);
  const [restingHeartRateYesterday, setRestingHeartRateYesterday] = useState<number | null>(null);
  const [avgDailySteps, setAvgDailySteps] = useState<number | null>(null);
  const [recentStepDays, setRecentStepDays] = useState<StepDayInput[]>([]);
  const [historyScores,   setHistoryScores]   = useState<ReadinessHistoryPoint[]>([]);

  const appStateRef       = useRef(AppState.currentState);
  const lastFetchDateRef  = useRef('');
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const proteinTarget = useMemo(() => {
    if (!user) return 150;
    try {
      return calculateMacros({
        sex:           user.sex,
        age:           user.age,
        heightCm:      user.heightCm,
        weightKg:      user.weightKg,
        activityLevel: user.activityLevel,
        goal:          user.goal,
      }).proteinG;
    } catch {
      return 150;
    }
  }, [user]);

  const calorieBudget = user?.calorieBudget ?? user?.tdee ?? 2000;

  const fetchRecoveryByDate = useCallback(async (date: string, force = false): Promise<RecoveryLog | null> => {
    if (!user?.id) return null;
    const key = buildResourceKey('recovery-today', user.id, date);
    return fetchWithResourceCache<RecoveryLog | null>(
      key,
      ttlForDate(date),
      async () => {
        const { ok, body } = await apiFetch(`/recovery/today?date=${date}`);
        if (ok && body.data) return fromApiLog(body.data as Record<string, unknown>);
        return null;
      },
      { force },
    );
  }, [user?.id]);

  const fetchToday = useCallback(async (force = false) => {
    if (!user?.id) return;
    const calendarToday = getLocalDateString();
    const sleepDay = localSleepDateString();
    const key = buildResourceKey('recovery-today', user.id, calendarToday);
    const result = await fetchWithResourceCache<RecoveryLog | null>(
      key,
      TTL_COLD_START_MS,
      async () => {
        const { ok, body } = await apiFetch('/recovery/today');
        if (ok && body.data) return fromApiLog(body.data as Record<string, unknown>);
        return null;
      },
      { force },
    );
    let merged = result ?? null;
    if (sleepDay !== calendarToday) {
      const prior = await fetchRecoveryByDate(sleepDay, force);
      merged = mergePriorDaySleepIntoRecovery(merged, prior);
    }
    setToday(merged);
  }, [user?.id, fetchRecoveryByDate]);

  const fetchReadiness = useCallback(async (force = false) => {
    if (!user?.id) return;
    const today = getLocalDateString();
    const key = buildResourceKey('recovery-readiness', user.id, today);
    const result = await fetchWithResourceCache<Readiness | null>(
      key,
      TTL_COLD_START_MS,
      async () => {
        const { ok, body } = await apiFetch('/recovery/readiness');
        if (ok && body.data) return fromApiReadiness(body.data as Record<string, unknown>);
        return null;
      },
      { force },
    );
    setReadiness(result ?? null);
  }, [user?.id]);

  const fetchReadinessHistory = useCallback(async (force = false) => {
    if (!user?.id) return;
    const today = getLocalDateString();
    // Key is month-scoped so past-day scores stay cached across day rollovers.
    const key = buildResourceKey('recovery-history', user.id, today.slice(0, 7));

    // If the cached result is missing yesterday's score, force a fresh fetch so the
    // backend backfill logic can compute and return it.
    if (!force) {
      const cached = await getResourceCached<ReadinessHistoryPoint[]>(key);
      if (cached?.data) {
        const yesterday = addLocalCalendarDays(today, -1);
        const hasYesterday = cached.data.some((p) => p.date === yesterday && p.score > 0);
        if (!hasYesterday) force = true;
      }
    }

    const result = await fetchWithResourceCache<ReadinessHistoryPoint[]>(
      key,
      TTL_BASELINES,
      async () => {
        const { ok, body } = await apiFetch('/recovery/readiness/history?days=30');
        if (!ok) return null;
        const rows = Array.isArray(body.data)
          ? body.data as Record<string, unknown>[]
          : Array.isArray(body.history)
            ? body.history as Record<string, unknown>[]
            : [];
        return rows
          .map((row) => ({
            date:  String(row.date ?? row.recorded_at ?? '').slice(0, 10),
            score: typeof row.score === 'number' ? row.score : 0,
          }))
          .filter((p) => p.date.length === 10 && p.score > 0);
      },
      { force },
    );
    setHistoryScores(result ?? []);
  }, [user?.id]);

  const fetchHealthBaselines = useCallback(async (force = false) => {
    if (!user?.id) return;
    const today = getLocalDateString();
    const key = buildResourceKey('health-baselines', user.id, today);
    const result = await fetchWithResourceCache<{
      hrv: number | null;
      hr: number | null;
      avgDailySteps: number | null;
    }>(
      key,
      TTL_BASELINES,
      async () => {
        const { ok, body } = await apiFetch('/health/history?days=30');
        if (!ok) return null;
        const rows = Array.isArray(body.data)
          ? body.data as Record<string, unknown>[]
          : Array.isArray(body.history)
            ? body.history as Record<string, unknown>[]
            : [];

        // EWMA needs chronological order (oldest → newest).
        const sorted = [...rows].sort((a, b) => {
          const da = String(a.date ?? a.recorded_at ?? a.created_at ?? '');
          const db = String(b.date ?? b.recorded_at ?? b.created_at ?? '');
          return da < db ? -1 : da > db ? 1 : 0;
        });

        const hrvValues = sorted
          .map((r) => nullableNum(r.hrv))
          .filter((v): v is number => v !== null && v > 0);
        const hrValues = sorted
          .map((r) => nullableNum(r.resting_heart_rate))
          .filter((v): v is number => v !== null && v > 0);
        const stepValues = sorted
          .map((r) => nullableNum(r.steps))
          .filter((v): v is number => v !== null && v >= 0);
        return {
          hrv: computeBaseline(hrvValues),
          hr: computeBaseline(hrValues),
          avgDailySteps: computeStepsBaseline(stepValues),
        };
      },
      { force },
    );
    if (result) {
      setHrvBaseline(result.hrv);
      setRestingHrBaseline(result.hr);
      setAvgDailySteps(result.avgDailySteps);
    }
  }, [user?.id]);

  const fetchWorkoutWindow = useCallback(async () => {
    const recentDays = datesLast7();
    const priorDays = datesPrior7();
    const today = getLocalDateString();
    const [recentBatches, priorBatches] = await Promise.all([
      Promise.all(
        recentDays.map((d) => (d === today ? Promise.resolve(todayWorkouts) : fetchWorkoutsForDate(d))),
      ),
      Promise.all(priorDays.map((d) => fetchWorkoutsForDate(d))),
    ]);
    setWorkouts7d(recentBatches.flat());
    setWorkoutsPrior7d(priorBatches.flat());
  }, [fetchWorkoutsForDate, todayWorkouts]);

  const fetchRecentStepDays = useCallback(async (force = false) => {
    const today = getLocalDateString();
    const days = [1, 2, 3].map((i) => addLocalCalendarDays(today, -i));
    const rows = await Promise.all(days.map((d) => fetchHealthForDate(d, force)));
    setRecentStepDays(
      days.map((date, i) => ({
        date,
        steps: rows[i]?.steps ?? 0,
      })),
    );
  }, [fetchHealthForDate]);

  const fetchYesterdayRhr = useCallback(async (force = false) => {
    if (!user?.id) return;
    const yesterday = addLocalCalendarDays(getLocalDateString(), -1);
    const [recovery, health] = await Promise.all([
      fetchRecoveryByDate(yesterday, force),
      fetchHealthForDate(yesterday, force),
    ]);
    const rhr = recovery?.resting_heart_rate ?? health?.resting_heart_rate ?? null;
    setRestingHeartRateYesterday(rhr !== null && rhr > 0 ? rhr : null);
  }, [user?.id, fetchRecoveryByDate, fetchHealthForDate]);

  const fetchYesterdayNutrition = useCallback(async () => {
    if (!user?.id) return;
    const today = getLocalDateString();
    const y  = addLocalCalendarDays(today, -1);
    const d2 = addLocalCalendarDays(today, -2);
    const [yBundle, d2Bundle] = await Promise.all([
      fetchDailySummaryBundle(user.id, y),
      fetchDailySummaryBundle(user.id, d2),
    ]);
    setYesterdaySummary(yBundle?.daily ?? null);
    setDayBeforeSummary(d2Bundle?.daily ?? null);
  }, [user?.id]);

  /** Paint cached recovery data immediately (including stale) before network. */
  const hydrateFromCache = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    const today = getLocalDateString();
    const uid   = user.id;
    const [todayCached, readinessCached, historyCached, baselinesCached] =
      await Promise.all([
        getResourceCached<RecoveryLog | null>(
          buildResourceKey('recovery-today', uid, today),
        ),
        getResourceCached<Readiness | null>(
          buildResourceKey('recovery-readiness', uid, today),
        ),
        getResourceCached<ReadinessHistoryPoint[]>(
          buildResourceKey('recovery-history', uid, today.slice(0, 7)),
        ),
        getResourceCached<{ hrv: number | null; hr: number | null; avgDailySteps: number | null }>(
          buildResourceKey('health-baselines', uid, today),
        ),
      ]);

    let hydrated = false;
    if (todayCached) {
      setToday(todayCached.data);
      hydrated = true;
    }
    if (readinessCached) {
      setReadiness(readinessCached.data);
      hydrated = true;
    }
    if (historyCached) {
      setHistoryScores(historyCached.data);
      hydrated = true;
    }
    if (baselinesCached) {
      setHrvBaseline(baselinesCached.data.hrv);
      setRestingHrBaseline(baselinesCached.data.hr);
      setAvgDailySteps(baselinesCached.data.avgDailySteps ?? null);
      hydrated = true;
    }
    return hydrated;
  }, [user?.id]);

  useEffect(() => {
    if (!hasActiveUserSession(status, user)) {
      setToday(null);
      setReadiness(null);
      setIsLoading(false);
      setInitialized(false);
      setWorkouts7d([]);
      setWorkoutsPrior7d([]);
      setYesterdaySummary(null);
      setDayBeforeSummary(null);
      setHrvBaseline(null);
      setRestingHrBaseline(null);
      setRestingHeartRateYesterday(null);
      setAvgDailySteps(null);
      setRecentStepDays([]);
      setHistoryScores([]);
      return;
    }
    // Kick off the full load (cache-first) as soon as the user is authenticated,
    // so baselines are ready before the Recovery screen is ever opened.
    if (!initialized) void refresh();
  }, [status, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active' && initialized) {
        const todayDate = getLocalDateString();
        if (lastFetchDateRef.current !== todayDate) {
          lastFetchDateRef.current = todayDate;
          void Promise.all([
            fetchToday(false),
            fetchReadiness(false),
            fetchReadinessHistory(false),
            fetchHealthBaselines(false),
            fetchWorkoutWindow(),
            fetchYesterdayNutrition(),
            fetchYesterdayRhr(),
            fetchRecentStepDays(),
          ]);
        }
      }
    });
    return () => sub.remove();
  }, [
    initialized,
    fetchToday,
    fetchReadiness,
    fetchReadinessHistory,
    fetchHealthBaselines,
    fetchWorkoutWindow,
    fetchYesterdayNutrition,
    fetchYesterdayRhr,
    fetchRecentStepDays,
  ]);

  const nutritionSummary = summaryToday ?? yesterdaySummary;

  const computed = useMemo(() => {
    if (status !== 'authenticated') return null;
    const input = buildReadinessInput({
      recoveryLog:         today,
      healthToday,
      checkinToday,
      cycle,
      userSex:             user?.sex ?? 'male',
      yesterdaySummary:    nutritionSummary,
      dayBeforeSummary,
      workouts7d,
      workoutsPrior7d,
      hrvBaseline,
      restingHrBaseline,
      restingHeartRateYesterday,
      proteinTarget,
      calorieBudget,
      waterGlassesToday:   summaryToday?.water_glasses ?? null,
      waterGoalMl:         user?.waterGoalMl ?? 2000,
      recentStepDays,
      avgDailySteps,
    });
    return computeReadiness(input);
  }, [
    status,
    today,
    healthToday,
    checkinToday,
    cycle,
    user?.sex,
    nutritionSummary,
    dayBeforeSummary,
    workouts7d,
    workoutsPrior7d,
    hrvBaseline,
    restingHrBaseline,
    restingHeartRateYesterday,
    proteinTarget,
    calorieBudget,
    summaryToday?.water_glasses,
    user?.waterGoalMl,
    recentStepDays,
    avgDailySteps,
  ]);

  /** Always stamp today's live computed score into a trend array so the calendar matches the ring. */
  const patchToday = useCallback((trend: ReadinessHistoryPoint[]): ReadinessHistoryPoint[] => {
    const todayDate = getLocalDateString();
    if (!computed) return trend;
    // Always override today — DB-persisted value may lag behind live computation.
    const without = trend.filter((p) => p.date !== todayDate);
    return [...without, { date: todayDate, score: computed.score }];
  }, [computed]);

  const trend7d = useMemo(
    () => patchToday(buildReadinessTrend(historyScores, undefined, 7)),
    [historyScores, patchToday],
  );

  const trend30d = useMemo(
    () => patchToday(buildReadinessTrend(historyScores, undefined, 30)),
    [historyScores, patchToday],
  );

  const display = useMemo((): RecoveryDisplay => {
    if (computed) {
      // Append a trend-direction note (rising/falling) when there's enough history (item 4).
      const trend = computeTrendDirection(trend7d, computed.score);
      const reason = trend.message
        ? `${computed.reason} ${trend.message}`.trim()
        : computed.reason;
      return {
        score:          computed.score,
        recommendation: computed.recommendation,
        reason,
        sleepScore:     computed.sleep_score,
        strainScore:    computed.strain_score,
        factors:        computed.factors,
        tips:           computed.tips,
        trend7d,
        trend30d,
      };
    }
    if (readiness) {
      return {
        score:          readiness.score,
        recommendation: readiness.recommendation,
        reason:         readiness.reason,
        sleepScore:     null,
        strainScore:    null,
        factors:        [],
        tips:           [],
        trend7d,
        trend30d,
      };
    }
    return { ...EMPTY_DISPLAY, trend7d, trend30d };
  }, [computed, readiness, trend7d, trend30d]);

  const hasInsufficientData = computed === null && readiness === null;

  const logRecovery = useCallback(async (
    input: LogRecoveryInput,
    options?: { notifyListeners?: boolean },
  ): Promise<RecoveryLog> => {
    const notifyListeners = options?.notifyListeners !== false;
    const { ok, body } = await apiFetch('/recovery/log', {
      method: 'POST',
      body:   JSON.stringify(input),
    });
    if (!ok || !body.data) {
      const msg = typeof body.error === 'string' ? body.error : 'Failed to log recovery';
      throw new Error(msg);
    }

    const data = body.data as Record<string, unknown>;
    const saved = fromApiLog(data);
    const logDate = input.date ?? getLocalDateString();

    const calendarToday = getLocalDateString();
    const sleepDay = localSleepDateString();
    if (logDate === calendarToday || logDate === sleepDay) {
      setToday(saved);
    }

    if (user?.id) {
      const uid = user.id;
      void setResourceCached(
        buildResourceKey('recovery-today', uid, logDate),
        saved,
        TTL_COLD_START_MS,
      );
      void invalidateResourceCache(buildResourceKey('recovery-readiness', uid, logDate));

      // Write-through the updated health row (it includes the new sleep) into the
      // health context + cache. Health subscribes to this channel — previously it
      // listened to nothing, so a manual sleep log never reached health state and
      // only its cache was dropped. Falls back to invalidation if the row is absent.
      if (data.health_data && typeof data.health_data === 'object') {
        const healthRow = data.health_data as Record<string, unknown>;
        applyHealthReconcile({
          date: logDate,
          row: healthRow,
        });

        const healthSleep =
          typeof healthRow.sleep_hours === 'number' && healthRow.sleep_hours > 0
            ? healthRow.sleep_hours
            : null;
        const savedSleep =
          saved.sleep_hours != null && saved.sleep_hours > 0 ? saved.sleep_hours : null;
        const sleepHours = healthSleep ?? savedSleep;
        const steps =
          typeof healthRow.steps === 'number' && healthRow.steps > 0
            ? healthRow.steps
            : null;
        if (sleepHours != null || steps != null) {
          const patch = { date: logDate, sleep_hours: sleepHours, steps };
          await writeThroughInsightsDayMetrics(uid, patch);
          applyInsightsMetricsPatch(patch);
        }
      } else {
        void invalidateResourceCache(buildResourceKey('health', uid, logDate));
        if (saved.sleep_hours != null && saved.sleep_hours > 0) {
          const patch = { date: logDate, sleep_hours: saved.sleep_hours };
          await writeThroughInsightsDayMetrics(uid, patch);
          applyInsightsMetricsPatch(patch);
        }
      }
    }

    if (data.readiness) {
      const newReadiness = fromApiReadiness(data.readiness as Record<string, unknown>);
      if (logDate === calendarToday || logDate === sleepDay) {
        setReadiness(newReadiness);
      }

      if (user?.id) {
        const histKey  = buildResourceKey('recovery-history', user.id, logDate.slice(0, 7));
        const cached   = await getResourceCached<ReadinessHistoryPoint[]>(histKey);
        const existing = cached?.data ?? [];
        const merged   = [
          ...existing.filter((p) => p.date !== logDate),
          { date: logDate, score: newReadiness.score },
        ];
        void setResourceCached(histKey, merged, TTL_BASELINES);
        if (logDate === getLocalDateString()) {
          setHistoryScores(merged);
        }
      }
    }

    if (notifyListeners && user?.id) {
      // Pass the explicit sleep/log date so summary + insights invalidate the
      // correct day/week — not getLocalDateString(), which diverges from the
      // sleep-date before 06:00.
      void notifyTodayDataChanged(user.id, 'recovery', logDate);
    }

    return saved;
  }, [user?.id]);

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    const force = options?.force ?? false;

    const run = (async () => {
      const hadCache = !force && (await hydrateFromCache());
      if (!hadCache) setIsLoading(true);

      lastFetchDateRef.current = getLocalDateString();
      try {
        await Promise.all([
          fetchToday(force),
          fetchReadiness(force),
          fetchReadinessHistory(force),
          fetchHealthBaselines(force),
          fetchWorkoutWindow(),
          fetchYesterdayNutrition(),
          fetchYesterdayRhr(force),
          fetchRecentStepDays(force),
        ]);
      } finally {
        setIsLoading(false);
        setInitialized(true);
      }
    })().finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = run;
    await run;
  }, [
    hydrateFromCache,
    fetchToday,
    fetchReadiness,
    fetchReadinessHistory,
    fetchHealthBaselines,
    fetchWorkoutWindow,
    fetchYesterdayNutrition,
    fetchYesterdayRhr,
    fetchRecentStepDays,
  ]);

  // A workout edit only moves training strain → the readiness score. Recompute
  // the 7-day workout window from in-memory `todayWorkouts` (past days come from
  // the 2 h cache) whenever today's workouts change, so the readiness ring stays
  // live WITHOUT force-refetching the whole recovery bundle on every set/delete.
  useEffect(() => {
    if (!initialized) return;
    void fetchWorkoutWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayWorkouts, initialized]);

  // Refetch when sleep / health / check-in data changes elsewhere so the Recovery
  // screen reflects it without a re-login. Force-refresh bypasses the 2 h cache;
  // refreshInFlightRef dedupes overlapping triggers. `initialized` stays true
  // throughout, so no loading flash — cached values stay on screen. Workouts are
  // intentionally excluded (handled reactively above).
  useEffect(() => {
    if (!hasActiveUserSession(status, user)) return;
    return registerTodayDataSyncListener(({ domain }) => {
      if (!shouldRefetchRecoveryAfterMutation(domain)) return;
      void refresh({ force: true });
    });
  }, [status, user?.id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RecoveryContext.Provider value={{
      today,
      readiness,
      computed,
      display,
      isLoading,
      initialized,
      hasInsufficientData,
      hrvBaseline,
      restingHrBaseline,
      logRecovery,
      fetchRecoveryByDate,
      refresh,
    }}>
      {children}
    </RecoveryContext.Provider>
  );
}

export function useRecovery(): RecoveryContextValue {
  const ctx = useContext(RecoveryContext);
  if (!ctx) throw new Error('useRecovery must be used inside <RecoveryProvider>');
  return ctx;
}
