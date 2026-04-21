import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE      = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS    = 10_000;
const DEFAULT_LIMIT = 30;

// ── Types ──────────────────────────────────────────────────────────────────

export type EnergyLevel       = 'low' | 'medium' | 'high';
export type WorkoutIntensity  = 'light' | 'moderate' | 'hard';

export interface CheckIn {
  id:                      string;
  date:                    string;
  sleep_quality:           number | null;
  energy_level:            EnergyLevel;
  worked_out:              boolean;
  workout_type:            string | null;
  workout_duration_mins:   number | null;
  workout_intensity:       WorkoutIntensity | null;
  calories_burned_from_workout: number | null;
  completed:               boolean;
  created_at:              string;
}

export interface LogCheckinInput {
  date:                   string;
  energy_level:           EnergyLevel;
  sleep_quality?:         number;
  worked_out?:            boolean;
  workout_type?:          string;
  workout_duration_mins?: number;
  workout_intensity?:     WorkoutIntensity;
}

export interface CheckinContextValue {
  /** Today's check-in, or null if not yet submitted. */
  today: CheckIn | null;

  /** Recent check-in history, newest first. */
  history: CheckIn[];

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  /** True if today's check-in has been completed. */
  hasCheckedInToday: boolean;

  /** Submits a check-in — hits POST /checkin. */
  submitCheckin: (input: LogCheckinInput) => Promise<CheckIn>;

  /** Fetches a single check-in by date — hits GET /checkin/:date. */
  fetchByDate: (date: string) => Promise<CheckIn | null>;

  /** Re-fetches today's check-in and history. */
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
    id:                           String(row.id ?? ''),
    date:                         String(row.date ?? ''),
    sleep_quality:                typeof row.sleep_quality === 'number' ? row.sleep_quality : null,
    energy_level:                 (row.energy_level as EnergyLevel) ?? 'medium',
    worked_out:                   row.worked_out === true,
    workout_type:                 typeof row.workout_type === 'string' ? row.workout_type : null,
    workout_duration_mins:        typeof row.workout_duration_mins === 'number' ? row.workout_duration_mins : null,
    workout_intensity:            typeof row.workout_intensity === 'string' ? (row.workout_intensity as WorkoutIntensity) : null,
    calories_burned_from_workout: typeof row.calories_burned_from_workout === 'number' ? row.calories_burned_from_workout : null,
    completed:                    row.completed === true,
    created_at:                   typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const CheckinContext = createContext<CheckinContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function CheckinProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [today,     setToday]     = useState<CheckIn | null>(null);
  const [history,   setHistory]   = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const hasCheckedInToday = useMemo(() => today?.completed === true, [today]);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchToday = useCallback(async () => {
    const { ok, body } = await checkinFetch(`/checkin/${todayDateString()}`);
    if (ok && body.checkin) setToday(fromApiCheckin(body.checkin as Record<string, unknown>));
  }, []);

  const fetchHistory = useCallback(async () => {
    const { ok, body } = await checkinFetch(`/checkin/history?limit=${DEFAULT_LIMIT}`);
    if (!ok) return;
    const rows = Array.isArray(body.checkins) ? body.checkins as Record<string, unknown>[] : [];
    setHistory(rows.map(fromApiCheckin));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setToday(null);
      setHistory([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setToday(null);
    setHistory([]);

    (async () => {
      try {
        await Promise.all([fetchToday(), fetchHistory()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchToday, fetchHistory]);

  // ── Submit check-in ──────────────────────────────────────────────────────
  const submitCheckin = useCallback(async (input: LogCheckinInput): Promise<CheckIn> => {
    const { ok, body } = await checkinFetch('/checkin', {
      method: 'POST',
      body:   JSON.stringify(input),
    });
    if (!ok || !body.checkin) throw new Error('Failed to submit check-in');
    const saved = fromApiCheckin(body.checkin as Record<string, unknown>);

    // Update today and upsert into history
    if (saved.date === todayDateString()) setToday(saved);
    setHistory((prev) => {
      const without = prev.filter((c) => c.date !== saved.date);
      return [saved, ...without];
    });

    return saved;
  }, []);

  // ── Fetch by date ────────────────────────────────────────────────────────
  const fetchByDate = useCallback(async (date: string): Promise<CheckIn | null> => {
    const { ok, body } = await checkinFetch(`/checkin/${date}`);
    if (!ok || !body.checkin) return null;
    return fromApiCheckin(body.checkin as Record<string, unknown>);
  }, []);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchToday(), fetchHistory()]);
  }, [fetchToday, fetchHistory]);

  return (
    <CheckinContext.Provider value={{
      today, history, isLoading, hasCheckedInToday,
      submitCheckin, fetchByDate, refresh,
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
