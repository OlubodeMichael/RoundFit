import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | null;
export type LifeStage  = 'regular' | 'postpartum' | 'perimenopause' | 'menopause';

export interface CycleLog {
  id:                    string;
  user_id:               string;
  period_start_date:     string;
  cycle_length:          number;
  predicted_next_period: string | null;
  phase:                 CyclePhase;
  notes:                 string | null;
  created_at:            string;
}

export interface AdjustedTargets {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

export interface CurrentCycle {
  available:             boolean;
  phase:                 CyclePhase;
  day_of_cycle:          number | null;
  days_remaining:        number | null;
  cycle_length:          number | null;
  last_period_date:      string | null;
  predicted_next_period: string | null;
  adjusted_targets:      AdjustedTargets | null;
  adjustment_reason:     string | null;
  phase_insight:         string | null;
  life_stage:            LifeStage | null;
  message?:              string;
}

export interface CycleStats {
  available:        boolean;
  total_cycles:     number;
  avg_cycle_length?: number;
  shortest_cycle?:  number;
  longest_cycle?:   number;
  first_logged?:    string;
  latest_logged?:   string;
  message?:         string;
}

export interface CycleContextValue {
  current:   CurrentCycle | null;
  history:   CycleLog[];
  stats:     CycleStats | null;
  isLoading: boolean;

  logPeriod:         (periodStartDate: string, cycleLength?: number, notes?: string) => Promise<CycleLog>;
  updateCycleLength: (cycleLength: number)     => Promise<{ predicted_next_period: string | null }>;
  updateLifeStage:   (lifeStage: LifeStage)    => Promise<{ adjusted_targets: AdjustedTargets; adjustment_reason: string }>;
  deleteLog:         (id: string)              => Promise<void>;
  refresh:           ()                        => Promise<void>;
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
    phase:                 (row.phase as CyclePhase) ?? null,
    notes:                 typeof row.notes === 'string' ? row.notes : null,
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
    available:             body.available === true,
    phase:                 (body.phase as CyclePhase) ?? null,
    day_of_cycle:          typeof body.day_of_cycle    === 'number' ? body.day_of_cycle    : null,
    days_remaining:        typeof body.days_remaining   === 'number' ? body.days_remaining   : null,
    cycle_length:          typeof body.cycle_length     === 'number' ? body.cycle_length     : null,
    last_period_date:      typeof body.last_period_date === 'string' ? body.last_period_date : null,
    predicted_next_period: typeof body.predicted_next_period === 'string' ? body.predicted_next_period : null,
    adjusted_targets,
    adjustment_reason:     typeof body.adjustment_reason === 'string' ? body.adjustment_reason : null,
    phase_insight:         typeof body.phase_insight    === 'string' ? body.phase_insight    : null,
    life_stage:            (body.life_stage as LifeStage) ?? null,
    message:               typeof body.message          === 'string' ? body.message          : undefined,
  };
}

function fromApiStats(body: Record<string, unknown>): CycleStats {
  return {
    available:        body.available === true,
    total_cycles:     typeof body.total_cycles    === 'number' ? body.total_cycles    : 0,
    avg_cycle_length: typeof body.avg_cycle_length === 'number' ? body.avg_cycle_length : undefined,
    shortest_cycle:   typeof body.shortest_cycle  === 'number' ? body.shortest_cycle  : undefined,
    longest_cycle:    typeof body.longest_cycle   === 'number' ? body.longest_cycle   : undefined,
    first_logged:     typeof body.first_logged    === 'string' ? body.first_logged    : undefined,
    latest_logged:    typeof body.latest_logged   === 'string' ? body.latest_logged   : undefined,
    message:          typeof body.message         === 'string' ? body.message         : undefined,
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const CycleContext = createContext<CycleContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [current,   setCurrent]   = useState<CurrentCycle | null>(null);
  const [history,   setHistory]   = useState<CycleLog[]>([]);
  const [stats,     setStats]     = useState<CycleStats | null>(null);
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

  const fetchStats = useCallback(async () => {
    const { ok, body } = await cycleFetch('/cycle/stats');
    if (ok) setStats(fromApiStats(body));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setCurrent(null);
      setHistory([]);
      setStats(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        await Promise.all([fetchCurrent(), fetchHistory(), fetchStats()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchCurrent, fetchHistory, fetchStats]);

  // ── Log period ───────────────────────────────────────────────────────────
  const logPeriod = useCallback(async (
    periodStartDate: string,
    cycleLength = 28,
    notes?: string,
  ): Promise<CycleLog> => {
    const { ok, body } = await cycleFetch('/cycle/log', {
      method: 'POST',
      body:   JSON.stringify({ period_start_date: periodStartDate, cycle_length: cycleLength, notes }),
    });
    if (!ok || !body.cycle_log) throw new Error((body.error as string) || 'Failed to log period');

    const saved = fromApiLog(body.cycle_log as Record<string, unknown>);
    setHistory((prev) => [saved, ...prev]);
    await Promise.all([fetchCurrent(), fetchStats()]);
    return saved;
  }, [fetchCurrent, fetchStats]);

  // ── Update cycle length ──────────────────────────────────────────────────
  const updateCycleLength = useCallback(async (cycleLength: number) => {
    const { ok, body } = await cycleFetch('/cycle/length', {
      method: 'PATCH',
      body:   JSON.stringify({ cycle_length: cycleLength }),
    });
    if (!ok) throw new Error((body.error as string) || 'Failed to update cycle length');

    const predicted = typeof body.predicted_next_period === 'string' ? body.predicted_next_period : null;
    setHistory((prev) => prev.map((c) => ({ ...c, cycle_length: cycleLength })));
    setCurrent((prev) => prev ? { ...prev, cycle_length: cycleLength, predicted_next_period: predicted } : prev);
    return { predicted_next_period: predicted };
  }, []);

  // ── Update life stage ────────────────────────────────────────────────────
  const updateLifeStage = useCallback(async (lifeStage: LifeStage) => {
    const { ok, body } = await cycleFetch('/cycle/life-stage', {
      method: 'PATCH',
      body:   JSON.stringify({ life_stage: lifeStage }),
    });
    if (!ok) throw new Error((body.error as string) || 'Failed to update life stage');

    const raw = body.adjusted_targets as Record<string, unknown> | null | undefined;
    const adjusted_targets: AdjustedTargets = raw
      ? {
          calories: typeof raw.calories === 'number' ? raw.calories : 0,
          protein:  typeof raw.protein  === 'number' ? raw.protein  : 0,
          carbs:    typeof raw.carbs    === 'number' ? raw.carbs    : 0,
          fat:      typeof raw.fat      === 'number' ? raw.fat      : 0,
        }
      : { calories: 0, protein: 0, carbs: 0, fat: 0 };

    const adjustment_reason = typeof body.adjustment_reason === 'string' ? body.adjustment_reason : '';
    setCurrent((prev) => prev ? { ...prev, life_stage: lifeStage, adjusted_targets, adjustment_reason } : prev);
    return { adjusted_targets, adjustment_reason };
  }, []);

  // ── Delete log ───────────────────────────────────────────────────────────
  const deleteLog = useCallback(async (id: string) => {
    const { ok, body } = await cycleFetch(`/cycle/${id}`, { method: 'DELETE' });
    if (!ok) throw new Error((body.error as string) || 'Failed to delete cycle log');

    setHistory((prev) => prev.filter((c) => c.id !== id));
    await Promise.all([fetchCurrent(), fetchStats()]);
  }, [fetchCurrent, fetchStats]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchCurrent(), fetchHistory(), fetchStats()]);
  }, [fetchCurrent, fetchHistory, fetchStats]);

  return (
    <CycleContext.Provider value={{
      current, history, stats, isLoading,
      logPeriod, updateCycleLength, updateLifeStage, deleteLog, refresh,
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
