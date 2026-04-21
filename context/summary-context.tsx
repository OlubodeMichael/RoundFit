import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;

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

// ── API helper ─────────────────────────────────────────────────────────────

async function summaryFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res  = await fetch(`${API_BASE}${path}`, {
      ...options, headers, credentials: 'include', signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

// ── Normalisation helpers ──────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
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

// ── Context ────────────────────────────────────────────────────────────────

const SummaryContext = createContext<SummaryContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function SummaryProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [daily,     setDaily]     = useState<DailySummary | null>(null);
  const [weekly,    setWeekly]    = useState<WeeklySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchTodayDaily = useCallback(async () => {
    const { ok, body } = await summaryFetch(`/summary/daily/${todayDateString()}`);
    if (ok && body.summary) setDaily(fromApiDaily(body.summary as Record<string, unknown>));
  }, []);

  const fetchWeekly = useCallback(async () => {
    const { ok, body } = await summaryFetch('/summary/weekly');
    if (ok) setWeekly(fromApiWeekly(body));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setDaily(null);
      setWeekly(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setDaily(null);
    setWeekly(null);

    (async () => {
      try {
        await Promise.all([fetchTodayDaily(), fetchWeekly()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchTodayDaily, fetchWeekly]);

  // ── Fetch daily by date ──────────────────────────────────────────────────
  const fetchDaily = useCallback(async (date: string): Promise<DailySummary | null> => {
    const { ok, body } = await summaryFetch(`/summary/daily/${date}`);
    if (!ok || !body.summary) return null;
    const result = fromApiDaily(body.summary as Record<string, unknown>);
    if (date === todayDateString()) setDaily(result);
    return result;
  }, []);

  // ── Update water ─────────────────────────────────────────────────────────
  const updateWater = useCallback(async (date: string, glasses: number) => {
    const snapshot = daily;
    // Optimistic update for today
    if (date === todayDateString()) {
      setDaily((prev) => prev ? { ...prev, water_glasses: glasses } : prev);
    }

    const { ok } = await summaryFetch('/summary/water', {
      method: 'PATCH',
      body:   JSON.stringify({ date, glasses }),
    });

    if (!ok) {
      if (date === todayDateString()) setDaily(snapshot);
      throw new Error('Failed to update water intake');
    }
  }, [daily]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchTodayDaily(), fetchWeekly()]);
  }, [fetchTodayDaily, fetchWeekly]);

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
