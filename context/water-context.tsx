import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { apiFetch } from '@/utils/api';
import { notifyTodayDataChanged } from '@/utils/today-sync';
import { shouldRefetchOnForeground } from '@/utils/foreground-refetch';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
} from '@/utils/resource-cache';

// ── Config ────────────────────────────────────────────────────────────────────

const TTL_WATER_MS    = 2 * 60 * 60 * 1000;
const DEFAULT_GOAL_ML = 2000;

interface WaterDayData {
  entries: WaterEntry[];
  goal_ml: number;
}

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
  refresh:     (date?: string, options?: { force?: boolean }) => Promise<void>;
  setGoal:     (ml: number) => Promise<void>;
  ensureLoaded: () => Promise<void>;
}

// ── Normalisation ─────────────────────────────────────────────────────────────

function fromApiEntry(row: Record<string, unknown>): WaterEntry {
  return {
    id:        String(row.id ?? ''),
    amount_ml: typeof row.amount_ml === 'number' ? row.amount_ml : 0,
    logged_at: typeof row.logged_at === 'string' ? row.logged_at : new Date().toISOString(),
  };
}

function parseWaterBody(body: Record<string, unknown>): WaterDayData {
  const raw = Array.isArray(body.entries)
    ? (body.entries as Record<string, unknown>[]).map(fromApiEntry)
    : [];
  const goal = typeof body.goal_ml === 'number' ? body.goal_ml : DEFAULT_GOAL_ML;
  return { entries: raw, goal_ml: goal };
}

function applyDayToState(
  setEntries: React.Dispatch<React.SetStateAction<WaterEntry[]>>,
  setGoalMl: React.Dispatch<React.SetStateAction<number>>,
  data: WaterDayData,
): void {
  setEntries(data.entries);
  setGoalMl(data.goal_ml);
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
  const appStateRef = useRef(AppState.currentState);
  const lastForegroundFetchRef = useRef(0);
  const loadInFlightRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => { goalMlRef.current = goalMl; }, [goalMl]);

  const totalMl = entries.reduce((s, e) => s + e.amount_ml, 0);

  const fetchWaterFromNetwork = useCallback(async (
    date: string,
    cacheKey: string,
  ): Promise<WaterDayData | null> => {
    const { ok, status, body } = await apiFetch(`/water?date=${date}`);

    if (status === 304) {
      const cached = await getResourceCached<WaterDayData>(cacheKey);
      return cached?.data ?? null;
    }

    if (!ok) return null;
    return parseWaterBody(body);
  }, []);

  const loadDate = useCallback(async (
    date: string,
    options?: { force?: boolean },
  ): Promise<void> => {
    if (!user?.id) return;

    const force = options?.force ?? false;
    const key = buildResourceKey('water', user.id, date);
    const inflightKey = `${key}:${force}`;

    if (!force) {
      const cached = await getResourceCached<WaterDayData>(key);
      if (cached) {
        applyDayToState(setEntries, setGoalMl, cached.data);
        if (!cached.isStale) return;
      }
    }

    const pending = loadInFlightRef.current.get(inflightKey);
    if (pending) {
      await pending;
      return;
    }

    const run = (async () => {
      const data = await fetchWithResourceCache<WaterDayData>(
        key,
        TTL_WATER_MS,
        () => fetchWaterFromNetwork(date, key),
        { force },
      );

      if (data) applyDayToState(setEntries, setGoalMl, data);
    })().finally(() => {
      loadInFlightRef.current.delete(inflightKey);
    });

    loadInFlightRef.current.set(inflightKey, run);
    await run;
  }, [user?.id, fetchWaterFromNetwork]);

  useEffect(() => {
    if (!hasActiveUserSession(status, user)) {
      setEntries([]);
      setGoalMl(DEFAULT_GOAL_ML);
      setIsLoading(false);
      loadInFlightRef.current.clear();
    }
  }, [status, user?.id]);

  useEffect(() => {
    if (!hasActiveUserSession(status, user)) return;

    let cancelled = false;
    (async () => {
      const key = buildResourceKey('water', user!.id, todayString());
      const cached = await getResourceCached<WaterDayData>(key);
      if (cached && !cancelled) {
        applyDayToState(setEntries, setGoalMl, cached.data);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (!prev.match(/inactive|background/) || next !== 'active') return;
      if (!user?.id) return;
      if (
        !shouldRefetchOnForeground({
          lastFetchAt: lastForegroundFetchRef.current,
          dayRolled: false,
        })
      ) {
        return;
      }
      lastForegroundFetchRef.current = Date.now();
      void loadDate(todayString(), { force: false });
    });
    return () => sub.remove();
  }, [user?.id, loadDate]);

  const ensureLoaded = useCallback(
    () => loadDate(todayString(), { force: false }),
    [loadDate],
  );

  const refresh = useCallback(async (
    date?: string,
    options?: { force?: boolean },
  ) => {
    const d = date ?? todayString();
    const force = options?.force ?? false;
    setIsLoading(true);
    try {
      await loadDate(d, { force });
      if (d === todayString()) {
        lastForegroundFetchRef.current = Date.now();
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadDate]);

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
      void notifyTodayDataChanged(user?.id, 'water');
      return saved;
    } catch (err) {
      setEntries((prev) => prev.filter((e) => e.id !== optimisticId));
      throw err;
    }
  }, [user?.id]);

  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      const { ok } = await apiFetch(`/water/${id}`, { method: 'DELETE' });
      if (!ok) throw new Error('Failed to delete water entry');
      void notifyTodayDataChanged(user?.id, 'water');
    } catch (err) {
      await loadDate(todayString(), { force: true });
      throw err;
    }
  }, [user?.id, loadDate]);

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
    if (user?.id) await loadDate(todayString(), { force: true });
  }, [user?.id, loadDate]);

  return (
    <WaterContext.Provider value={{
      entries, totalMl, goalMl, isLoading,
      logWater, deleteEntry, refresh, setGoal, ensureLoaded,
    }}>
      {children}
    </WaterContext.Provider>
  );
}

export function useWater(): WaterContextValue {
  const ctx = useContext(WaterContext);
  if (!ctx) throw new Error('useWater must be used inside <WaterProvider>');
  return ctx;
}
