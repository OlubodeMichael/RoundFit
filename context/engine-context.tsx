import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface DailyEngine {
  calorie_budget:    number;
  calories_consumed: number;
  calories_burned:   number;
  delta:             number;
  daily_score:       number;
  status:            string | null;
  action:            string | null;
  prediction:        string | null;
  hours_remaining:   number | null;
  readiness_score:   number | null;
}

export interface DetectedPattern {
  id:              string;
  pattern_type:    string;
  description:     string;
  confidence:      number;
  first_detected:  string | null;
  last_confirmed:  string | null;
  times_confirmed: number;
}

export interface EngineContextValue {
  /** Aggregated daily engine output. Null until first load. */
  daily: DailyEngine | null;

  /** Detected behavioural patterns. */
  patterns: DetectedPattern[];

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  /** Re-fetches daily engine data — hits GET /engine/daily. */
  refreshDaily: () => Promise<void>;

  /** Runs pattern detection — hits GET /engine/patterns. */
  refreshPatterns: () => Promise<void>;

  /** Re-fetches both daily and patterns. */
  refresh: () => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────

async function engineFetch(
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

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback;
}

function nullableStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function nullableNum(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}

function fromApiDaily(row: Record<string, unknown>): DailyEngine {
  return {
    calorie_budget:    num(row.calorie_budget),
    calories_consumed: num(row.calories_consumed),
    calories_burned:   num(row.calories_burned),
    delta:             num(row.delta),
    daily_score:       num(row.daily_score),
    status:            nullableStr(row.status),
    action:            nullableStr(row.action),
    prediction:        nullableStr(row.prediction),
    hours_remaining:   nullableNum(row.hours_remaining),
    readiness_score:   nullableNum(row.readiness_score),
  };
}

function fromApiPattern(row: Record<string, unknown>): DetectedPattern {
  return {
    id:              String(row.id ?? ''),
    pattern_type:    String(row.pattern_type ?? ''),
    description:     String(row.description ?? ''),
    confidence:      num(row.confidence),
    first_detected:  nullableStr(row.first_detected),
    last_confirmed:  nullableStr(row.last_confirmed),
    times_confirmed: num(row.times_confirmed),
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const EngineContext = createContext<EngineContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [daily,     setDaily]     = useState<DailyEngine | null>(null);
  const [patterns,  setPatterns]  = useState<DetectedPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchDaily = useCallback(async () => {
    const { ok, body } = await engineFetch('/engine/daily');
    if (ok && body.data) setDaily(fromApiDaily(body.data as Record<string, unknown>));
  }, []);

  const fetchPatterns = useCallback(async () => {
    const { ok, body } = await engineFetch('/engine/patterns');
    if (!ok) return;
    const rows = Array.isArray(body.data) ? body.data as Record<string, unknown>[] : [];
    setPatterns(rows.map(fromApiPattern));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setDaily(null);
      setPatterns([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setDaily(null);
    setPatterns([]);

    (async () => {
      try {
        await Promise.all([fetchDaily(), fetchPatterns()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchDaily, fetchPatterns]);

  // ── Public refresh handles ───────────────────────────────────────────────
  const refreshDaily    = useCallback(() => fetchDaily(),    [fetchDaily]);
  const refreshPatterns = useCallback(() => fetchPatterns(), [fetchPatterns]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchDaily(), fetchPatterns()]);
  }, [fetchDaily, fetchPatterns]);

  return (
    <EngineContext.Provider value={{
      daily, patterns, isLoading,
      refreshDaily, refreshPatterns, refresh,
    }}>
      {children}
    </EngineContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used inside <EngineProvider>');
  return ctx;
}
