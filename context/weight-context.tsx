import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;
const DEFAULT_LIMIT = 30;

// ── Types ──────────────────────────────────────────────────────────────────

export interface WeightEntry {
  id:        string;
  weight_kg: number;
  logged_at: string;
}

export interface WeightContextValue {
  /** Weight logs, newest first. */
  entries: WeightEntry[];

  /** Most recent logged weight, or null if none. */
  latest: WeightEntry | null;

  /** True while the initial fetch is in-flight. */
  isLoading: boolean;

  /** Logs a new weight entry — hits POST /weight. */
  logWeight: (weightKg: number, unit?: 'metric' | 'imperial') => Promise<WeightEntry>;

  /** Re-fetches weight history from the server. */
  refresh: (limit?: number) => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────

async function weightFetch(
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

function fromApiEntry(row: Record<string, unknown>): WeightEntry {
  return {
    id:        String(row.id ?? ''),
    weight_kg: typeof row.weight_kg === 'number' ? row.weight_kg : 0,
    logged_at: typeof row.logged_at === 'string' ? row.logged_at : new Date().toISOString(),
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const WeightContext = createContext<WeightContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function WeightProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [entries,   setEntries]   = useState<WeightEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const latest = useMemo(() => entries[0] ?? null, [entries]);

  // ── Fetch entries ────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async (limit = DEFAULT_LIMIT) => {
    const { ok, body } = await weightFetch(`/weight?limit=${limit}`);
    if (!ok) return;
    const rows = Array.isArray(body.data) ? body.data as Record<string, unknown>[] : [];
    setEntries(rows.map(fromApiEntry));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setEntries([]);

    (async () => {
      try {
        await fetchEntries();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchEntries]);

  // ── Log weight ───────────────────────────────────────────────────────────
  const logWeight = useCallback(async (
    weightKg: number,
    unit: 'metric' | 'imperial' = 'metric',
  ): Promise<WeightEntry> => {
    const { ok, body } = await weightFetch('/weight', {
      method: 'POST',
      body:   JSON.stringify({ weight_kg: weightKg, unit }),
    });
    if (!ok || !body.data) throw new Error('Failed to log weight');
    const saved = fromApiEntry(body.data as Record<string, unknown>);
    setEntries((prev) => [saved, ...prev]);
    return saved;
  }, []);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async (limit?: number) => {
    await fetchEntries(limit);
  }, [fetchEntries]);

  return (
    <WeightContext.Provider value={{
      entries, latest, isLoading,
      logWeight, refresh,
    }}>
      {children}
    </WeightContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWeight(): WeightContextValue {
  const ctx = useContext(WeightContext);
  if (!ctx) throw new Error('useWeight must be used inside <WeightProvider>');
  return ctx;
}
