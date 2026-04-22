import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE      = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS    = 10_000;
const DEFAULT_LIMIT = 30;

// ── Types ──────────────────────────────────────────────────────────────────

export type EnergyLevel = 'low' | 'medium' | 'high';

export interface CheckIn {
  id:              string;
  user_id:         string;
  date:            string;
  sleep_quality:   number | null;
  energy_level:    EnergyLevel;
  planned_workout: boolean;
  completed:       boolean;
  skipped:         boolean;
  completed_at:    string | null;
}

export interface MorningCheckinInput {
  date:              string;
  sleep_quality:     number;
  energy_level:      EnergyLevel;
  planned_workout?:  boolean;
}

export interface CheckinInsight {
  id:           string;
  message:      string;
  type:         string;
  triggered_by: string;
  date:         string;
}

export interface CheckinStatus {
  should_show_checkin:       boolean;
  should_show_workout_prompt: boolean;
  checkin_completed:         boolean;
  workout_logged:            boolean;
  reason:                    string | null;
}

export interface CheckinStats {
  total_days:        number;
  completed_days:    number;
  skipped_days:      number;
  completion_rate:   number;
  avg_sleep_quality: number;
  energy_breakdown: {
    low:    number;
    medium: number;
    high:   number;
  };
}

export interface CheckinContextValue {
  /** Today's check-in, or null if not yet submitted. */
  today: CheckIn | null;

  /** Recent check-in history, newest first. */
  history: CheckIn[];

  /** Aggregate stats across the last 30 check-ins. */
  stats: CheckinStats | null;

  /**
   * App-open status response — whether to show the check-in modal or
   * workout prompt. Null until first fetch.
   */
  appStatus: CheckinStatus | null;

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  /** True if today's check-in has been completed or skipped. */
  hasCheckedInToday: boolean;

  /** Convenience flag — true when the check-in modal should be shown. */
  shouldShowCheckin: boolean;

  /** Convenience flag — true when the workout prompt should be shown. */
  shouldShowWorkoutPrompt: boolean;

  /**
   * Submits the morning check-in — hits POST /checkin/morning.
   * Returns the saved check-in and the auto-generated insight.
   */
  submitMorningCheckin: (
    input: MorningCheckinInput,
  ) => Promise<{ checkin: CheckIn; insight: CheckinInsight | null }>;

  /**
   * Skips today's check-in — hits POST /checkin/skip.
   * Still triggers a fallback insight server-side.
   */
  skipCheckin: (date: string) => Promise<CheckIn>;

  /** Fetches a single check-in by date — hits GET /checkin/:date. */
  fetchByDate: (date: string) => Promise<CheckIn | null>;

  /** Re-fetches the app-open status — hits GET /checkin/status. */
  refreshStatus: () => Promise<void>;

  /** Re-fetches today's check-in, history, and stats. */
  refresh: () => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────

async function checkinFetch(
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

function fromApiCheckin(row: Record<string, unknown>): CheckIn {
  return {
    id:              String(row.id ?? ''),
    user_id:         String(row.user_id ?? ''),
    date:            String(row.date ?? ''),
    sleep_quality:   typeof row.sleep_quality === 'number' ? row.sleep_quality : null,
    energy_level:    (row.energy_level as EnergyLevel) ?? 'medium',
    planned_workout: row.planned_workout === true,
    completed:       row.completed === true,
    skipped:         row.skipped === true,
    completed_at:    typeof row.completed_at === 'string' ? row.completed_at : null,
  };
}

function fromApiInsight(row: Record<string, unknown>): CheckinInsight {
  return {
    id:           String(row.id ?? ''),
    message:      String(row.message ?? ''),
    type:         String(row.type ?? 'rules'),
    triggered_by: String(row.triggered_by ?? ''),
    date:         String(row.date ?? ''),
  };
}

function fromApiStatus(body: Record<string, unknown>): CheckinStatus {
  return {
    should_show_checkin:        body.should_show_checkin        === true,
    should_show_workout_prompt: body.should_show_workout_prompt === true,
    checkin_completed:          body.checkin_completed          === true,
    workout_logged:             body.workout_logged             === true,
    reason:                     typeof body.reason === 'string' ? body.reason : null,
  };
}

function fromApiStats(body: Record<string, unknown>): CheckinStats {
  const eb = (body.energy_breakdown as Record<string, unknown>) ?? {};
  return {
    total_days:        typeof body.total_days        === 'number' ? body.total_days        : 0,
    completed_days:    typeof body.completed_days    === 'number' ? body.completed_days    : 0,
    skipped_days:      typeof body.skipped_days      === 'number' ? body.skipped_days      : 0,
    completion_rate:   typeof body.completion_rate   === 'number' ? body.completion_rate   : 0,
    avg_sleep_quality: typeof body.avg_sleep_quality === 'number' ? body.avg_sleep_quality : 0,
    energy_breakdown: {
      low:    typeof eb.low    === 'number' ? eb.low    : 0,
      medium: typeof eb.medium === 'number' ? eb.medium : 0,
      high:   typeof eb.high   === 'number' ? eb.high   : 0,
    },
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const CheckinContext = createContext<CheckinContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function CheckinProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [today,     setToday]     = useState<CheckIn | null>(null);
  const [history,   setHistory]   = useState<CheckIn[]>([]);
  const [stats,     setStats]     = useState<CheckinStats | null>(null);
  const [appStatus, setAppStatus] = useState<CheckinStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasCheckedInToday     = useMemo(() => today?.completed === true, [today]);
  const shouldShowCheckin     = useMemo(() => appStatus?.should_show_checkin        ?? false, [appStatus]);
  const shouldShowWorkoutPrompt = useMemo(() => appStatus?.should_show_workout_prompt ?? false, [appStatus]);

  // ── Fetch helpers ────────────────────────────────────────────────────────

  const fetchAppStatus = useCallback(async () => {
    const { ok, body } = await checkinFetch('/checkin/status');
    if (ok) setAppStatus(fromApiStatus(body));
  }, []);

  const fetchToday = useCallback(async () => {
    const { ok, body } = await checkinFetch('/checkin/today');
    if (ok && body.checkin) setToday(fromApiCheckin(body.checkin as Record<string, unknown>));
  }, []);

  const fetchHistory = useCallback(async () => {
    const { ok, body } = await checkinFetch(`/checkin/history?limit=${DEFAULT_LIMIT}`);
    if (!ok) return;
    const rows = Array.isArray(body.checkins) ? body.checkins as Record<string, unknown>[] : [];
    setHistory(rows.map(fromApiCheckin));
  }, []);

  const fetchStats = useCallback(async () => {
    const { ok, body } = await checkinFetch('/checkin/stats');
    if (ok) setStats(fromApiStats(body));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setToday(null);
      setHistory([]);
      setStats(null);
      setAppStatus(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setToday(null);
    setHistory([]);
    setStats(null);
    setAppStatus(null);

    (async () => {
      try {
        await Promise.all([
          fetchAppStatus(),
          fetchToday(),
          fetchHistory(),
          fetchStats(),
        ]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchAppStatus, fetchToday, fetchHistory, fetchStats]);

  // ── Submit morning check-in ──────────────────────────────────────────────
  const submitMorningCheckin = useCallback(async (
    input: MorningCheckinInput,
  ): Promise<{ checkin: CheckIn; insight: CheckinInsight | null }> => {
    const { ok, body } = await checkinFetch('/checkin/morning', {
      method: 'POST',
      body:   JSON.stringify({
        date:             input.date,
        sleep_quality:    input.sleep_quality,
        energy_level:     input.energy_level,
        planned_workout:  input.planned_workout ?? false,
      }),
    });
    if (!ok || !body.checkin) {
      throw new Error((body.error as string) || 'Failed to submit check-in');
    }

    const checkin = fromApiCheckin(body.checkin as Record<string, unknown>);
    const insight = body.insight
      ? fromApiInsight(body.insight as Record<string, unknown>)
      : null;

    const dateStr = todayDateString();
    if (checkin.date === dateStr) setToday(checkin);
    setHistory((prev) => {
      const without = prev.filter((c) => c.date !== checkin.date);
      return [checkin, ...without];
    });

    // Refresh status so should_show_checkin flips to false
    void fetchAppStatus();

    return { checkin, insight };
  }, [fetchAppStatus]);

  // ── Skip check-in ────────────────────────────────────────────────────────
  const skipCheckin = useCallback(async (date: string): Promise<CheckIn> => {
    const { ok, body } = await checkinFetch('/checkin/skip', {
      method: 'POST',
      body:   JSON.stringify({ date }),
    });
    if (!ok || !body.checkin) {
      throw new Error((body.error as string) || 'Failed to skip check-in');
    }

    const checkin = fromApiCheckin(body.checkin as Record<string, unknown>);
    if (checkin.date === todayDateString()) setToday(checkin);
    setHistory((prev) => {
      const without = prev.filter((c) => c.date !== checkin.date);
      return [checkin, ...without];
    });

    void fetchAppStatus();

    return checkin;
  }, [fetchAppStatus]);

  // ── Fetch by date ────────────────────────────────────────────────────────
  const fetchByDate = useCallback(async (date: string): Promise<CheckIn | null> => {
    const { ok, body } = await checkinFetch(`/checkin/${date}`);
    if (!ok || !body.checkin) return null;
    return fromApiCheckin(body.checkin as Record<string, unknown>);
  }, []);

  // ── Refresh status ───────────────────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    await fetchAppStatus();
  }, [fetchAppStatus]);

  // ── Full refresh ─────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchAppStatus(), fetchToday(), fetchHistory(), fetchStats()]);
  }, [fetchAppStatus, fetchToday, fetchHistory, fetchStats]);

  return (
    <CheckinContext.Provider value={{
      today, history, stats, appStatus, isLoading,
      hasCheckedInToday, shouldShowCheckin, shouldShowWorkoutPrompt,
      submitMorningCheckin, skipCheckin, fetchByDate, refreshStatus, refresh,
    }}>
      {children}
    </CheckinContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useCheckin(): CheckinContextValue {
  const ctx = useContext(CheckinContext);
  if (!ctx) throw new Error('useCheckin must be used inside <CheckinProvider>');
  return ctx;
}
