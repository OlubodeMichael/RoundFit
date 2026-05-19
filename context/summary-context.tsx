import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/context/auth-context';
import { getLocalDateString } from '@/utils/date';
import {
  buildSummaryCacheKey,
  fetchDailySummaryBundle,
  getCachedSummary,
  TTL_COLD_START_MS,
  TTL_FOREGROUND_SKIP_MS,
} from '@/utils/daily-summary-cache';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
} from '@/utils/resource-cache';
import { getWeekStart } from '@/utils/insights-aggregator';
import {
  registerTodayDataSyncListener,
  registerTodayTargetsListener,
  syncTodayAfterMutation,
} from '@/utils/today-sync';
import {
  registerTodayOptimisticListener,
  type TodayDataDelta,
} from '@/utils/today-optimistic';
import { apiFetch } from '@/utils/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type CalorieBurnSource = 'healthkit' | 'checkin' | 'baseline';

export interface DailySummary {
  date:                string;
  calorie_budget:      number;
  calories_consumed:   number;
  calories_burned:     number;
  net_calories:        number;
  delta:               number;
  protein_consumed:    number;
  carbs_consumed:      number;
  fat_consumed:        number;
  water_glasses:       number;
  calorie_burn_source: CalorieBurnSource | null;
}

export interface WeeklySummary {
  days:               DailySummary[];
  consistency_score:  number;
  avg_calories:       number;
  avg_protein:        number;
  best_day:           string | null;
}

export interface SummaryContextValue {
  /** Summary for today (or the last fetched date). */
  daily: DailySummary | null;

  /** Rolling 7-day summary. */
  weekly: WeeklySummary | null;

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  /** Fetches the daily summary for a specific date — hits GET /summary/daily/:date. */
  fetchDaily: (date: string) => Promise<DailySummary | null>;

  /** Updates water glass count for a date — hits PATCH /summary/water. */
  updateWater: (date: string, glasses: number) => Promise<void>;

  /** Re-fetches today's daily summary and the weekly summary. */
  refresh: () => Promise<void>;
}


// ── Normalisation helpers ──────────────────────────────────────────────────

function todayDateString(): string {
  return getLocalDateString();
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback;
}

function fromApiDaily(row: Record<string, unknown>): DailySummary {
  return {
    date:                String(row.date ?? ''),
    calorie_budget:      num(row.calorie_budget),
    calories_consumed:   num(row.calories_consumed),
    calories_burned:     num(row.calories_burned),
    net_calories:        num(row.net_calories),
    delta:               num(row.delta),
    protein_consumed:    num(row.protein_consumed),
    carbs_consumed:      num(row.carbs_consumed),
    fat_consumed:        num(row.fat_consumed),
    water_glasses:       num(row.water_glasses),
    calorie_burn_source: typeof row.calorie_burn_source === 'string'
      ? (row.calorie_burn_source as CalorieBurnSource)
      : null,
  };
}

function fromApiWeekly(body: Record<string, unknown>): WeeklySummary {
  const days = Array.isArray(body.days)
    ? (body.days as Record<string, unknown>[]).map(fromApiDaily)
    : [];
  return {
    days,
    consistency_score: num(body.consistency_score),
    avg_calories:      num(body.avg_calories),
    avg_protein:       num(body.avg_protein),
    best_day:          typeof body.best_day === 'string' ? body.best_day : null,
  };
}

function patchDailyRow(day: DailySummary, delta: TodayDataDelta): DailySummary {
  const calories_consumed = day.calories_consumed + (delta.caloriesConsumed ?? 0);
  const protein_consumed  = day.protein_consumed  + (delta.proteinConsumed ?? 0);
  const carbs_consumed    = day.carbs_consumed    + (delta.carbsConsumed ?? 0);
  const fat_consumed      = day.fat_consumed      + (delta.fatConsumed ?? 0);
  const calories_burned   = day.calories_burned   + (delta.caloriesBurned ?? 0);
  const water_glasses     = delta.waterGlasses ?? day.water_glasses;
  const net_calories      = calories_consumed - calories_burned;
  const deltaVal          = calories_consumed - day.calorie_budget;

  return {
    ...day,
    calories_consumed,
    protein_consumed,
    carbs_consumed,
    fat_consumed,
    calories_burned,
    water_glasses,
    net_calories,
    delta: deltaVal,
  };
}

function upsertTodayInWeekly(weekly: WeeklySummary, day: DailySummary): WeeklySummary {
  const hasToday = weekly.days.some((d) => d.date === day.date);
  const days = hasToday
    ? weekly.days.map((d) => (d.date === day.date ? day : d))
    : [...weekly.days, day];
  const logged = days.filter((d) => d.calories_consumed > 0);
  return {
    ...weekly,
    days,
    avg_calories: logged.length
      ? Math.round(logged.reduce((s, d) => s + d.calories_consumed, 0) / logged.length)
      : weekly.avg_calories,
    avg_protein: logged.length
      ? Math.round(logged.reduce((s, d) => s + d.protein_consumed, 0) / logged.length)
      : weekly.avg_protein,
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const SummaryContext = createContext<SummaryContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function SummaryProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [daily,     setDaily]     = useState<DailySummary | null>(null);
  const [weekly,    setWeekly]    = useState<WeeklySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appStateRef           = useRef(AppState.currentState);
  const lastFetchDateRef      = useRef('');
  const lastForegroundFetchRef = useRef(0);

  const fetchWeekly = useCallback(async (force = false) => {
    if (!user?.id) return;

    const weekStart = getWeekStart();
    const key       = buildResourceKey('summary-weekly', user.id, weekStart);
    const parsed = await fetchWithResourceCache<WeeklySummary | null>(
      key,
      TTL_COLD_START_MS,
      async () => {
        const { ok, body } = await apiFetch(`/summary/weekly?weekStart=${weekStart}`);
        if (!ok) return null;
        return fromApiWeekly(body);
      },
      { force },
    );

    if (parsed) setWeekly(parsed);
  }, [user?.id]);

  const loadTodayDaily = useCallback(async (force = false) => {
    if (!user?.id) return;
    const today = todayDateString();
    const bundle = await fetchDailySummaryBundle(user.id, today, { force });
    if (bundle) setDaily(bundle.daily);
  }, [user?.id]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setDaily(null);
      setWeekly(null);
      setIsLoading(false);
      lastFetchDateRef.current = '';
      lastForegroundFetchRef.current = 0;
      return;
    }

    let cancelled = false;

    if (!user?.id) return;

    (async () => {
      const today     = todayDateString();
      const weekStart = getWeekStart();
      const dailyKey  = buildSummaryCacheKey(user.id, today);
      const weeklyKey = buildResourceKey('summary-weekly', user.id, weekStart);

      const [dailyCached, weeklyCached] = await Promise.all([
        getCachedSummary(dailyKey),
        getResourceCached<WeeklySummary>(weeklyKey),
      ]);

      if (!cancelled) {
        if (dailyCached) setDaily(dailyCached.data.daily);
        if (weeklyCached) setWeekly(weeklyCached.data);
        if (dailyCached || weeklyCached) setIsLoading(false);
        else setIsLoading(true);
      }

      try {
        lastFetchDateRef.current = today;
        lastForegroundFetchRef.current = Date.now();
        await Promise.all([loadTodayDaily(false), fetchWeekly(false)]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, loadTodayDaily, fetchWeekly]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (!prev.match(/inactive|background/) || next !== 'active') return;
      if (status !== 'authenticated' || !user?.id) return;

      const today = todayDateString();
      const dayRolled = lastFetchDateRef.current !== today;
      const stale = Date.now() - lastForegroundFetchRef.current > TTL_FOREGROUND_SKIP_MS;

      if (!dayRolled && !stale) return;

      lastFetchDateRef.current = today;
      lastForegroundFetchRef.current = Date.now();
      void Promise.all([
        loadTodayDaily(dayRolled),
        dayRolled ? fetchWeekly(true) : Promise.resolve(),
      ]);
    });
    return () => sub.remove();
  }, [status, user?.id, loadTodayDaily, fetchWeekly]);

  useEffect(() => {
    return registerTodayDataSyncListener(async () => {
      if (!user?.id) return;
      await loadTodayDaily(true);
      await fetchWeekly(true);
    });
  }, [user?.id, loadTodayDaily, fetchWeekly]);

  const applyOptimisticDelta = useCallback((delta: TodayDataDelta) => {
    const today = todayDateString();
    const budget = user?.calorieBudget ?? user?.tdee ?? 2000;

    setDaily((prev) => {
      const base: DailySummary = prev ?? {
        date:                today,
        calorie_budget:      budget,
        calories_consumed:   0,
        calories_burned:     0,
        net_calories:        0,
        delta:               0,
        protein_consumed:    0,
        carbs_consumed:      0,
        fat_consumed:        0,
        water_glasses:       0,
        calorie_burn_source: null,
      };
      return patchDailyRow(base, delta);
    });

    setWeekly((prev) => {
      if (!prev) return prev;
      const todayRow = prev.days.find((d) => d.date === today);
      const base: DailySummary = todayRow ?? {
        date:                today,
        calorie_budget:      budget,
        calories_consumed:   0,
        calories_burned:     0,
        net_calories:        0,
        delta:               0,
        protein_consumed:    0,
        carbs_consumed:      0,
        fat_consumed:        0,
        water_glasses:       0,
        calorie_burn_source: null,
      };
      const patched = patchDailyRow(base, delta);
      return upsertTodayInWeekly(prev, patched);
    });
  }, [user?.calorieBudget, user?.tdee]);

  useEffect(() => {
    return registerTodayOptimisticListener(applyOptimisticDelta);
  }, [applyOptimisticDelta]);

  useEffect(() => {
    return registerTodayTargetsListener(() => {
      const budget = user?.calorieBudget ?? user?.tdee;
      if (budget == null) return;
      setDaily((prev) => {
        if (!prev) return prev;
        if (prev.calorie_budget === budget) return prev;
        return { ...prev, calorie_budget: budget, delta: prev.calories_consumed - budget };
      });
      setWeekly((weekly) => {
        if (!weekly) return weekly;
        return {
          ...weekly,
          days: weekly.days.map((d) => (
            d.calorie_budget === budget
              ? d
              : { ...d, calorie_budget: budget, delta: d.calories_consumed - budget }
          )),
        };
      });
    });
  }, [user?.calorieBudget, user?.tdee]);

  useEffect(() => {
    const budget = user?.calorieBudget ?? user?.tdee;
    if (budget == null) return;
    setDaily((prev) => {
      if (!prev || prev.calorie_budget === budget) return prev;
      return { ...prev, calorie_budget: budget, delta: prev.calories_consumed - budget };
    });
    setWeekly((weekly) => {
      if (!weekly) return weekly;
      const needsPatch = weekly.days.some((d) => d.calorie_budget !== budget);
      if (!needsPatch) return weekly;
      return {
        ...weekly,
        days: weekly.days.map((d) => ({
          ...d,
          calorie_budget: budget,
          delta: d.calories_consumed - budget,
        })),
      };
    });
  }, [user?.calorieBudget, user?.tdee]);

  const fetchDaily = useCallback(async (date: string): Promise<DailySummary | null> => {
    if (!user?.id) return null;
    const bundle = await fetchDailySummaryBundle(user.id, date);
    if (!bundle) return null;
    if (date === todayDateString()) setDaily(bundle.daily);
    return bundle.daily;
  }, [user?.id]);

  const updateWater = useCallback(async (date: string, glasses: number) => {
    const previousGlasses = daily?.water_glasses;
    if (date === todayDateString()) {
      applyOptimisticDelta({ waterGlasses: glasses });
    }

    const { ok } = await apiFetch('/summary/water', {
      method: 'PATCH',
      body:   JSON.stringify({ date, glasses }),
    });

    if (!ok) {
      if (date === todayDateString() && previousGlasses != null) {
        applyOptimisticDelta({ waterGlasses: previousGlasses });
      }
      throw new Error('Failed to update water intake');
    }

    if (user?.id) void syncTodayAfterMutation(user.id);
  }, [daily?.water_glasses, user?.id, applyOptimisticDelta]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    lastForegroundFetchRef.current = Date.now();
    await syncTodayAfterMutation(user.id);
  }, [user?.id]);

  return (
    <SummaryContext.Provider value={{
      daily, weekly, isLoading,
      fetchDaily, updateWater, refresh,
    }}>
      {children}
    </SummaryContext.Provider>
  );
}



// ── Hook ──────────────────────────────────────────────────────────────────

export function useSummary(): SummaryContextValue {
  const ctx = useContext(SummaryContext);
  if (!ctx) throw new Error('useSummary must be used inside <SummaryProvider>');
  return ctx;
}
