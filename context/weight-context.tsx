import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/utils/api';

// ── Config ─────────────────────────────────────────────────────────────────

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

  /** True once the first fetch has completed (set false until progress tab is visited). */
  initialized: boolean;

  /** Logs a new weight entry — hits POST /weight. */
  logWeight: (weightKg: number, unit?: 'metric' | 'imperial') => Promise<WeightEntry>;

  /** Re-fetches weight history from the server. */
  refresh: (limit?: number) => Promise<void>;
}

// ── Normalisation helpers ──────────────────────────────────────────────────

function fromApiEntry(row: Record<string, unknown>): WeightEntry {
  return {
    id:        String(row.id ?? ''),
    weight_kg: typeof row.weight === 'number' ? row.weight : typeof row.weight_kg === 'number' ? row.weight_kg : 0,
    logged_at: typeof row.logged_at === 'string' ? row.logged_at : new Date().toISOString(),
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const WeightContext = createContext<WeightContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function WeightProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [entries,     setEntries]     = useState<WeightEntry[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [initialized, setInitialized] = useState(false);

  const latest = useMemo(() => entries[0] ?? null, [entries]);

  // ── Fetch entries ────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async (limit = DEFAULT_LIMIT) => {
    const { ok, body } = await apiFetch(`/weight?limit=${limit}`);
    if (!ok) return;
    const rows = Array.isArray(body.data) ? body.data as Record<string, unknown>[] : [];
    setEntries(rows.map(fromApiEntry));
  }, []);

  // Reset state on logout only — data is fetched lazily when progress tab is first visited.
  useEffect(() => {
    if (status === 'unauthenticated') {
      setEntries([]);
      setIsLoading(false);
      setInitialized(false);
    }
  }, [status, user?.id]);

  // ── Log weight ───────────────────────────────────────────────────────────
  const logWeight = useCallback(async (
    weightKg: number,
    unit: 'metric' | 'imperial' = 'metric',
  ): Promise<WeightEntry> => {
    const { ok, body } = await apiFetch('/weight', {
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
    setIsLoading(true);
    try {
      await fetchEntries(limit);
    } finally {
      setIsLoading(false);
      setInitialized(true);
    }
  }, [fetchEntries]);

  return (
    <WeightContext.Provider value={{
      entries, latest, isLoading, initialized,
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
