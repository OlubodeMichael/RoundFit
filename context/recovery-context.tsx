import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;

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
}

export interface RecoveryContextValue {
  /** Today's recovery log, or null if not yet logged. */
  today: RecoveryLog | null;

  /** Latest readiness score. */
  readiness: Readiness | null;

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  /** Logs today's recovery — hits POST /recovery/log. Also updates readiness. */
  logRecovery: (input: LogRecoveryInput) => Promise<RecoveryLog>;

  /** Re-fetches today's log and readiness score from the server. */
  refresh: () => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────

async function recoveryFetch(
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

// ── Context ────────────────────────────────────────────────────────────────

const RecoveryContext = createContext<RecoveryContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function RecoveryProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [today,     setToday]     = useState<RecoveryLog | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchToday = useCallback(async () => {
    const { ok, body } = await recoveryFetch('/recovery/today');
    if (ok && body.data) setToday(fromApiLog(body.data as Record<string, unknown>));
  }, []);

  const fetchReadiness = useCallback(async () => {
    const { ok, body } = await recoveryFetch('/recovery/readiness');
    if (ok && body.data) setReadiness(fromApiReadiness(body.data as Record<string, unknown>));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setToday(null);
      setReadiness(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setToday(null);
    setReadiness(null);

    (async () => {
      try {
        await Promise.all([fetchToday(), fetchReadiness()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchToday, fetchReadiness]);

  // ── Log recovery ─────────────────────────────────────────────────────────
  const logRecovery = useCallback(async (input: LogRecoveryInput): Promise<RecoveryLog> => {
    const { ok, body } = await recoveryFetch('/recovery/log', {
      method: 'POST',
      body:   JSON.stringify(input),
    });
    if (!ok || !body.data) throw new Error('Failed to log recovery');

    const data = body.data as Record<string, unknown>;
    const saved = fromApiLog(data);
    setToday(saved);

    // Server returns readiness inline — apply it immediately without a round-trip
    if (data.readiness) {
      setReadiness(fromApiReadiness(data.readiness as Record<string, unknown>));
    }

    return saved;
  }, []);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchToday(), fetchReadiness()]);
  }, [fetchToday, fetchReadiness]);

  return (
    <RecoveryContext.Provider value={{ today, readiness, isLoading, logRecovery, refresh }}>
      {children}
    </RecoveryContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useRecovery(): RecoveryContextValue {
  const ctx = useContext(RecoveryContext);
  if (!ctx) throw new Error('useRecovery must be used inside <RecoveryProvider>');
  return ctx;
}
