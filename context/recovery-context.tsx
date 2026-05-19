import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/context/auth-context';
import { useCheckin } from '@/context/checkin-context';
import { useCycle } from '@/context/cycle-context';
import { useHealth } from '@/context/health-context';
import type { DailySummary } from '@/context/summary-context';
import { useSummary } from '@/context/summary-context';
import { useWorkouts } from '@/context/workout-context';
import type { Workout } from '@/context/workout-context';
import type { ComputedReadiness, ReadinessFactor, ReadinessHistoryPoint, ReadinessTip } from '@/types/readiness';
import { buildReadinessInput, yesterdayDateString } from '@/utils/build-readiness-input';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import { calculateMacros } from '@/utils/nutrition';
import {
  buildReadinessTrend,
  computeReadiness,
} from '@/utils/readiness';
import { apiFetch } from '@/utils/api';
import { fetchDailySummaryBundle, TTL_COLD_START_MS } from '@/utils/daily-summary-cache';
import { syncTodayAfterMutation } from '@/utils/today-sync';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  setResourceCached,
  invalidateResourceCache,
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
  logRecovery: (input: LogRecoveryInput) => Promise<RecoveryLog>;
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

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
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
  const { today: healthToday } = useHealth();
  const { today: checkinToday } = useCheckin();
  const { current: cycle } = useCycle();
  const { daily: summaryToday } = useSummary();
  const { workouts: todayWorkouts, fetchForDate: fetchWorkoutsForDate } = useWorkouts();

  const [today,           setToday]           = useState<RecoveryLog | null>(null);
  const [readiness,       setReadiness]       = useState<Readiness | null>(null);
  const [isLoading,       setIsLoading]       = useState(false);
  const [initialized,     setInitialized]     = useState(false);
  const [workouts7d,      setWorkouts7d]      = useState<Workout[]>([]);
  const [yesterdaySummary, setYesterdaySummary] = useState<DailySummary | null>(null);
  const [hrvBaseline,     setHrvBaseline]     = useState<number | null>(null);
  const [restingHrBaseline, setRestingHrBaseline] = useState<number | null>(null);
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

  const fetchToday = useCallback(async (force = false) => {
    if (!user?.id) return;
    const today = getLocalDateString();
    const key = buildResourceKey('recovery-today', user.id, today);
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
    setToday(result ?? null);
  }, [user?.id]);

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
    const key = buildResourceKey('recovery-history', user.id, today);
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
    const result = await fetchWithResourceCache<{ hrv: number | null; hr: number | null }>(
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
        const hrvValues = rows
          .map((r) => nullableNum(r.hrv))
          .filter((v): v is number => v !== null && v > 0);
        const hrValues = rows
          .map((r) => nullableNum(r.resting_heart_rate))
          .filter((v): v is number => v !== null && v > 0);
        return { hrv: average(hrvValues), hr: average(hrValues) };
      },
      { force },
    );
    if (result) {
      setHrvBaseline(result.hrv);
      setRestingHrBaseline(result.hr);
    }
  }, [user?.id]);

  const fetchWorkoutWindow = useCallback(async () => {
    const days = datesLast7();
    const today = getLocalDateString();
    const batches = await Promise.all(
      days.map((d) => (d === today ? Promise.resolve(todayWorkouts) : fetchWorkoutsForDate(d))),
    );
    setWorkouts7d(batches.flat());
  }, [fetchWorkoutsForDate, todayWorkouts]);

  const fetchYesterdayNutrition = useCallback(async () => {
    if (!user?.id) return;
    const y = yesterdayDateString(getLocalDateString());
    const bundle = await fetchDailySummaryBundle(user.id, y);
    setYesterdaySummary(bundle?.daily ?? null);
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
          buildResourceKey('recovery-history', uid, today),
        ),
        getResourceCached<{ hrv: number | null; hr: number | null }>(
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
      hydrated = true;
    }
    return hydrated;
  }, [user?.id]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      setToday(null);
      setReadiness(null);
      setIsLoading(false);
      setInitialized(false);
      setWorkouts7d([]);
      setYesterdaySummary(null);
      setHrvBaseline(null);
      setRestingHrBaseline(null);
      setHistoryScores([]);
    }
  }, [status, user?.id]);

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
      workouts7d,
      hrvBaseline,
      restingHrBaseline,
      proteinTarget,
      calorieBudget,
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
    workouts7d,
    hrvBaseline,
    restingHrBaseline,
    proteinTarget,
    calorieBudget,
  ]);

  /** Merge live computed score for today when API history has not persisted yet. */
  const patchToday = useCallback((trend: ReadinessHistoryPoint[]): ReadinessHistoryPoint[] => {
    const todayDate = getLocalDateString();
    if (!computed) return trend;
    const hasToday = trend.some((p) => p.date === todayDate && p.score > 0);
    if (hasToday) return trend;
    return trend.map((p) => (p.date === todayDate ? { ...p, score: computed.score } : p));
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
      return {
        score:          computed.score,
        recommendation: computed.recommendation,
        reason:         computed.reason,
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

  const logRecovery = useCallback(async (input: LogRecoveryInput): Promise<RecoveryLog> => {
    const { ok, body } = await apiFetch('/recovery/log', {
      method: 'POST',
      body:   JSON.stringify(input),
    });
    if (!ok || !body.data) throw new Error('Failed to log recovery');

    const data = body.data as Record<string, unknown>;
    const saved = fromApiLog(data);
    setToday(saved);

    if (user?.id) {
      const today = getLocalDateString();
      void setResourceCached(buildResourceKey('recovery-today', user.id, today), saved, TTL_COLD_START_MS);
      void Promise.all([
        invalidateResourceCache(buildResourceKey('recovery-readiness', user.id, today)),
        invalidateResourceCache(buildResourceKey('recovery-history', user.id, today)),
      ]);
    }

    if (data.readiness) {
      setReadiness(fromApiReadiness(data.readiness as Record<string, unknown>));
    }

    if (user?.id) void syncTodayAfterMutation(user.id);

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
  ]);

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
