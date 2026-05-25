import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { apiFetch } from '@/utils/api';
import {
  buildResourceKey,
  fetchWithResourceCache,
  invalidateResourceCache,
} from '@/utils/resource-cache';

// ── Config ────────────────────────────────────────────────────────────────────

const TTL_WATER_MS    = 2 * 60 * 60 * 1000; // 2 h — same as other today-data
const DEFAULT_GOAL_ML = 2000;

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WaterEntry {
  id:        string;
  amount_ml: number;
  logged_at: string;
}

export interface WaterContextValue {
  entries:     WaterEntry[];
  totalMl:     number;
  goalMl:      number;
  isLoading:   boolean;
  logWater:    (amountMl: number) => Promise<WaterEntry>;
  deleteEntry: (id: string) => Promise<void>;
  refresh:     (date?: string) => Promise<void>;
  setGoal:     (ml: number) => Promise<void>;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

function fromApiEntry(row: Record<string, unknown>): WaterEntry {
  return {
    id:        String(row.id ?? ''),
    amount_ml: typeof row.amount_ml === 'number' ? row.amount_ml : 0,
    logged_at: typeof row.logged_at === 'string' ? row.logged_at : new Date().toISOString(),
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

const WaterContext = createContext<WaterContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function WaterProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [entries,   setEntries]   = useState<WaterEntry[]>([]);
  const [goalMl,    setGoalMl]    = useState(DEFAULT_GOAL_ML);
  const [isLoading, setIsLoading] = useState(false);

  const goalMlRef = useRef(goalMl);
  useEffect(() => { goalMlRef.current = goalMl; }, [goalMl]);

  const totalMl = entries.reduce((s, e) => s + e.amount_ml, 0);

  // ── Internal fetch ────────────────────────────────────────────────────────

  const fetchForDate = useCallback(async (date: string, force = false) => {
    if (!user?.id) return;

    const key = buildResourceKey('water', user.id, date);
    const data = await fetchWithResourceCache<{ entries: WaterEntry[]; goal_ml: number }>(
      key,
      TTL_WATER_MS,
      async () => {
        const { ok, body } = await apiFetch(`/water?date=${date}`);
        if (!ok) return null;
        const raw = Array.isArray(body.entries)
          ? (body.entries as Record<string, unknown>[]).map(fromApiEntry)
          : [];
        const goal = typeof body.goal_ml === 'number' ? body.goal_ml : DEFAULT_GOAL_ML;
        return { entries: raw, goal_ml: goal };
      },
      { force },
    );

    if (data) {
      setEntries(data.entries);
      setGoalMl(data.goal_ml);
    }
  }, [user?.id]);

  // ── Reset on logout ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasActiveUserSession(status, user)) {
      setEntries([]);
      setGoalMl(DEFAULT_GOAL_ML);
      setIsLoading(false);
    }
  }, [status, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch today on mount / login ──────────────────────────────────────────

  useEffect(() => {
    if (!hasActiveUserSession(status, user)) return;
    setIsLoading(true);
    fetchForDate(todayString()).finally(() => setIsLoading(false));
  }, [status, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── logWater ──────────────────────────────────────────────────────────────

  const logWater = useCallback(async (amountMl: number): Promise<WaterEntry> => {
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: WaterEntry = {
      id:        optimisticId,
      amount_ml: amountMl,
      logged_at: new Date().toISOString(),
    };
    setEntries((prev) => [optimistic, ...prev]);

    try {
      const { ok, body } = await apiFetch('/water', {
        method: 'POST',
        body:   JSON.stringify({ amount_ml: amountMl }),
      });
      if (!ok || !body.data) throw new Error('Failed to log water');

      const saved = fromApiEntry(body.data as Record<string, unknown>);
      setEntries((prev) => prev.map((e) => (e.id === optimisticId ? saved : e)));
      void invalidateResourceCache(buildResourceKey('water', user?.id ?? '', todayString()));
      return saved;
    } catch (err) {
      setEntries((prev) => prev.filter((e) => e.id !== optimisticId));
      throw err;
    }
  }, [user?.id]);

  // ── deleteEntry ───────────────────────────────────────────────────────────

  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      const { ok } = await apiFetch(`/water/${id}`, { method: 'DELETE' });
      if (!ok) throw new Error('Failed to delete water entry');
      void invalidateResourceCache(buildResourceKey('water', user?.id ?? '', todayString()));
    } catch (err) {
      void fetchForDate(todayString(), true);
      throw err;
    }
  }, [user?.id, fetchForDate]);

  // ── setGoal ───────────────────────────────────────────────────────────────

  const setGoal = useCallback(async (ml: number): Promise<void> => {
    const previous = goalMlRef.current;
    setGoalMl(ml);
    const { ok } = await apiFetch('/profile', {
      method: 'PATCH',
      body:   JSON.stringify({ water_goal_ml: ml }),
    });
    if (!ok) {
      setGoalMl(previous);
      throw new Error('Failed to update water goal');
    }
  }, []);

  // ── refresh ───────────────────────────────────────────────────────────────

  const refresh = useCallback(async (date?: string) => {
    const d = date ?? todayString();
    setIsLoading(true);
    try {
      await fetchForDate(d, true);
    } finally {
      setIsLoading(false);
    }
  }, [fetchForDate]);

  return (
    <WaterContext.Provider value={{
      entries, totalMl, goalMl, isLoading,
      logWater, deleteEntry, refresh, setGoal,
    }}>
      {children}
    </WaterContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWater(): WaterContextValue {
  const ctx = useContext(WaterContext);
  if (!ctx) throw new Error('useWater must be used inside <WaterProvider>');
  return ctx;
}
