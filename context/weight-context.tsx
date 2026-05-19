import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/utils/api';
import { TTL_COLD_START_MS } from '@/utils/daily-summary-cache';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  setResourceCached,
} from '@/utils/resource-cache';

// ── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 30;
const TTL_WEIGHT_HISTORY = TTL_COLD_START_MS;

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

  /** Re-fetches weight history; uses AsyncStorage unless `force` is true. */
  refresh: (options?: { limit?: number; force?: boolean }) => Promise<void>;
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

  const fetchEntries = useCallback(async (limit = DEFAULT_LIMIT, force = false) => {
    if (!user?.id) return;

    const key = buildResourceKey('weight', user.id, String(limit));
    const rows = await fetchWithResourceCache<WeightEntry[]>(
      key,
      TTL_WEIGHT_HISTORY,
      async () => {
        const { ok, body } = await apiFetch(`/weight?limit=${limit}`);
        if (!ok) return null;
        const raw = Array.isArray(body.data) ? body.data as Record<string, unknown>[] : [];
        return raw.map(fromApiEntry);
      },
      { force },
    );

    if (rows) setEntries(rows);
  }, [user?.id]);

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
    setEntries((prev) => {
      const next = [saved, ...prev.filter((e) => e.id !== saved.id)];
      if (user?.id) {
        void setResourceCached(
          buildResourceKey('weight', user.id, String(DEFAULT_LIMIT)),
          next,
          TTL_WEIGHT_HISTORY,
        );
      }
      return next;
    });

    return saved;
  }, [user?.id]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async (options?: { limit?: number; force?: boolean }) => {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const force = options?.force ?? false;

    if (!force && user?.id) {
      const cached = await getResourceCached<WeightEntry[]>(
        buildResourceKey('weight', user.id, String(limit)),
      );
      if (cached) {
        setEntries(cached.data);
        setInitialized(true);
        if (!cached.isStale) {
          setIsLoading(false);
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      await fetchEntries(limit, force);
    } finally {
      setIsLoading(false);
      setInitialized(true);
    }
  }, [fetchEntries, user?.id]);

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
