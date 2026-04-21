import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | null;

export interface CycleLog {
  id:                   string;
  user_id:              string;
  period_start_date:    string;
  cycle_length:         number;
  predicted_next_period: string | null;
  created_at:           string;
}

export interface AdjustedTargets {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

export interface CurrentCycle {
  phase:                 CyclePhase;
  days_remaining:        number | null;
  predicted_next_period: string | null;
  adjusted_targets:      AdjustedTargets | null;
  adjustment_reason:     string | null;
}

export interface CycleContextValue {
  /** Current cycle phase + adjusted nutrition targets. Null until loaded. */
  current: CurrentCycle | null;

  /** Last 6 logged cycles, newest first. */
  history: CycleLog[];

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  /** Logs a new period start — hits POST /cycle/log. */
  logPeriod: (periodStartDate: string, cycleLength?: number) => Promise<CycleLog>;

  /** Updates the user's default cycle length — hits PATCH /cycle/length. */
  updateCycleLength: (cycleLength: number) => Promise<void>;

  /** Re-fetches current phase and history from the server. */
  refresh: () => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────

async function cycleFetch(
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

function fromApiLog(row: Record<string, unknown>): CycleLog {
  return {
    id:                    String(row.id ?? ''),
    user_id:               String(row.user_id ?? ''),
    period_start_date:     String(row.period_start_date ?? ''),
    cycle_length:          typeof row.cycle_length === 'number' ? row.cycle_length : 28,
    predicted_next_period: typeof row.predicted_next_period === 'string' ? row.predicted_next_period : null,
    created_at:            typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

function fromApiCurrent(body: Record<string, unknown>): CurrentCycle {
  const raw = body.adjusted_targets as Record<string, unknown> | null | undefined;
  const adjusted_targets: AdjustedTargets | null = raw
    ? {
        calories: typeof raw.calories === 'number' ? raw.calories : 0,
        protein:  typeof raw.protein  === 'number' ? raw.protein  : 0,
        carbs:    typeof raw.carbs    === 'number' ? raw.carbs    : 0,
        fat:      typeof raw.fat      === 'number' ? raw.fat      : 0,
      }
    : null;

  return {
    phase:                 (body.phase as CyclePhase) ?? null,
    days_remaining:        typeof body.days_remaining === 'number' ? body.days_remaining : null,
    predicted_next_period: typeof body.predicted_next_period === 'string' ? body.predicted_next_period : null,
    adjusted_targets,
    adjustment_reason:     typeof body.adjustment_reason === 'string' ? body.adjustment_reason : null,
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const CycleContext = createContext<CycleContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [current,  setCurrent]  = useState<CurrentCycle | null>(null);
  const [history,  setHistory]  = useState<CycleLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchCurrent = useCallback(async () => {
    const { ok, body } = await cycleFetch('/cycle/current');
    if (ok) setCurrent(fromApiCurrent(body));
  }, []);

  const fetchHistory = useCallback(async () => {
    const { ok, body } = await cycleFetch('/cycle/history');
    if (!ok) return;
    const rows = Array.isArray(body.cycles) ? body.cycles as Record<string, unknown>[] : [];
    setHistory(rows.map(fromApiLog));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setCurrent(null);
      setHistory([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        await Promise.all([fetchCurrent(), fetchHistory()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchCurrent, fetchHistory]);

  // ── Log period ───────────────────────────────────────────────────────────
  const logPeriod = useCallback(async (
    periodStartDate: string,
    cycleLength = 28,
  ): Promise<CycleLog> => {
    const { ok, body } = await cycleFetch('/cycle/log', {
      method: 'POST',
      body:   JSON.stringify({ period_start_date: periodStartDate, cycle_length: cycleLength }),
    });
    if (!ok || !body.cycle_log) throw new Error('Failed to log period');

    const saved = fromApiLog(body.cycle_log as Record<string, unknown>);
    setHistory((prev) => [saved, ...prev]);

    // Refresh current phase since a new period changes the phase calculation
    await fetchCurrent();

    return saved;
  }, [fetchCurrent]);

  // ── Update cycle length ──────────────────────────────────────────────────
  const updateCycleLength = useCallback(async (cycleLength: number) => {
    const { ok } = await cycleFetch('/cycle/length', {
      method: 'PATCH',
      body:   JSON.stringify({ cycle_length: cycleLength }),
    });
    if (!ok) throw new Error('Failed to update cycle length');

    // Reflect the new length in history entries optimistically
    setHistory((prev) => prev.map((c) => ({ ...c, cycle_length: cycleLength })));
    await fetchCurrent();
  }, [fetchCurrent]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchCurrent(), fetchHistory()]);
  }, [fetchCurrent, fetchHistory]);

  return (
    <CycleContext.Provider value={{
      current, history, isLoading,
      logPeriod, updateCycleLength, refresh,
    }}>
      {children}
    </CycleContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useCycle(): CycleContextValue {
  const ctx = useContext(CycleContext);
  if (!ctx) throw new Error('useCycle must be used inside <CycleProvider>');
  return ctx;
}
