import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { CYCLE_ENABLED } from '@/constants/features';
import { apiFetch } from '@/utils/api';
import { TTL_COLD_START_MS } from '@/utils/daily-summary-cache';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  invalidateResourceCache,
} from '@/utils/resource-cache';

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
  /** False for male profiles — no cycle API calls are made. */
  isEnabled: boolean;

  /** Current cycle phase + adjusted nutrition targets. Null until loaded. */
  current: CurrentCycle | null;

  /** Last 6 logged cycles, newest first. */
  history: CycleLog[];

  /** Aggregate cycle statistics. Null until loaded. */
  stats: CycleStats | null;

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  logPeriod:         (periodStartDate: string, cycleLength?: number, notes?: string) => Promise<CycleLog>;
  updateCycleLength: (cycleLength: number)     => Promise<{ predicted_next_period: string | null }>;
  updateLifeStage:   (lifeStage: LifeStage)    => Promise<{ adjusted_targets: AdjustedTargets; adjustment_reason: string }>;
  deleteLog:         (id: string)              => Promise<void>;
  refresh:           ()                        => Promise<void>;
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

export function isCycleTrackingEnabled(
  sex: string | undefined,
): boolean {
  return sex === 'female';
}

// ── Provider ───────────────────────────────────────────────────────────────

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const isEnabled = CYCLE_ENABLED && isCycleTrackingEnabled(user?.sex);

  const [current,   setCurrent]   = useState<CurrentCycle | null>(null);
  const [history,   setHistory]   = useState<CycleLog[]>([]);
  const [stats,     setStats]     = useState<CycleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchCycleBundle = useCallback(async (force = false) => {
    if (!user?.id || !CYCLE_ENABLED || !isCycleTrackingEnabled(user.sex)) return;

    const key = buildResourceKey('cycle', user.id);
    const bundle = await fetchWithResourceCache<{
      current: CurrentCycle | null;
      history: CycleLog[];
    } | null>(
      key,
      TTL_COLD_START_MS,
      async () => {
        const [currentRes, historyRes] = await Promise.all([
          apiFetch('/cycle/current'),
          apiFetch('/cycle/history'),
        ]);
        const history = historyRes.ok
          ? (Array.isArray(historyRes.body.cycles)
            ? historyRes.body.cycles as Record<string, unknown>[]
            : []
          ).map(fromApiLog)
          : [];
        const current = currentRes.ok
          ? fromApiCurrent(currentRes.body)
          : null;
        return { current, history };
      },
      { force },
    );

    if (bundle) {
      setCurrent(bundle.current);
      setHistory(bundle.history);
    }
  }, [user?.id, user?.sex]);

  const fetchStats = useCallback(async () => {
    const { ok, body } = await apiFetch('/cycle/stats');
    if (ok) setStats(fromApiStats(body));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (!hasActiveUserSession(status, user)) {
      setCurrent(null);
      setHistory([]);
      setIsLoading(false);
      return;
    }

    if (!isEnabled) {
      setCurrent(null);
      setHistory([]);
      setStats(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const key = buildResourceKey('cycle', user.id);
      const cached = await getResourceCached<{
        current: CurrentCycle | null;
        history: CycleLog[];
      }>(key);
      if (cached && !cancelled) {
        setCurrent(cached.data.current);
        setHistory(cached.data.history);
        setIsLoading(false);
      } else if (!cancelled) {
        setIsLoading(true);
      }

      try {
        await Promise.all([fetchCycleBundle(false), fetchStats()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, user?.sex, isEnabled, fetchCycleBundle, fetchStats]);

  // ── Log period ───────────────────────────────────────────────────────────
  const logPeriod = useCallback(async (
    periodStartDate: string,
    cycleLength = 28,
    notes?: string,
  ): Promise<CycleLog> => {
    if (!CYCLE_ENABLED || !isCycleTrackingEnabled(user?.sex)) {
      throw new Error('Cycle tracking is not enabled for this profile');
    }

    const { ok, body } = await apiFetch('/cycle/log', {
      method: 'POST',
      body:   JSON.stringify({ period_start_date: periodStartDate, cycle_length: cycleLength, notes }),
    });
    if (!ok || !body.cycle_log) throw new Error((body.error as string) || 'Failed to log period');

    const saved = fromApiLog(body.cycle_log as Record<string, unknown>);
    setHistory((prev) => [saved, ...prev]);

    if (user?.id) {
      await invalidateResourceCache(buildResourceKey('cycle', user.id));
    }
    await Promise.all([fetchCycleBundle(true), fetchStats()]);

    return saved;
  }, [fetchCycleBundle, fetchStats, user?.id, user?.sex]);

  // ── Update cycle length ──────────────────────────────────────────────────
  const updateCycleLength = useCallback(async (cycleLength: number) => {
    if (!CYCLE_ENABLED || !isCycleTrackingEnabled(user?.sex)) {
      throw new Error('Cycle tracking is not enabled for this profile');
    }

    const { ok, body } = await apiFetch('/cycle/length', {
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
    const { ok, body } = await apiFetch('/cycle/life-stage', {
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
    const { ok, body } = await apiFetch(`/cycle/${id}`, { method: 'DELETE' });
    if (!ok) throw new Error((body.error as string) || 'Failed to delete cycle log');

    setHistory((prev) => prev.filter((c) => c.id !== id));
    if (user?.id) {
      await invalidateResourceCache(buildResourceKey('cycle', user.id));
    }
    await Promise.all([fetchCycleBundle(true), fetchStats()]);
  }, [fetchCycleBundle, fetchStats, user?.id]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!CYCLE_ENABLED || !isCycleTrackingEnabled(user?.sex)) return;
    if (user?.id) {
      await invalidateResourceCache(buildResourceKey('cycle', user.id));
    }
    await Promise.all([fetchCycleBundle(true), fetchStats()]);
  }, [fetchCycleBundle, fetchStats, user?.id, user?.sex]);

  return (
    <CycleContext.Provider value={{
      isEnabled, current, history, stats, isLoading,
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
