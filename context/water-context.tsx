import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { apiFetch } from '@/utils/api';
import { notifyTodayDataChanged } from '@/utils/today-sync';
import { applyBadgesUnlocked, type BadgeAwardRef } from '@/utils/badges-cache';
import { applyTodayReconcile, type TodayReconcileBundle } from '@/utils/today-reconcile';
import { shouldRefetchOnForeground } from '@/utils/foreground-refetch';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  invalidateResourceCache,
  setResourceCached,
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
  /** Re-fetches today's water log. Past-day browsing uses `fetchForDate` locally. */
  refresh:     (options?: { force?: boolean }) => Promise<void>;
  fetchForDate: (date: string, force?: boolean) => Promise<WaterDayData>;
  deleteEntryForDate: (date: string, id: string) => Promise<void>;
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

/**
 * Pulls the `today` reconciliation block out of a mutation response, if present.
 * Returns null when the backend does not (yet) include it — the legacy
 * `notifyTodayDataChanged` path remains the fallback.
 */
import type { BadgeAwardRef } from '@/utils/badges-cache';

function extractBadgesUnlocked(body: Record<string, unknown>): BadgeAwardRef[] {
  if (!Array.isArray(body.badges_unlocked)) return [];
  return body.badges_unlocked
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (typeof row.award_id !== 'string' || typeof row.badge_id !== 'string') return null;
      return { award_id: row.award_id, badge_id: row.badge_id };
    })
    .filter((ref): ref is BadgeAwardRef => !!ref);
}

function extractTodayBundle(body: Record<string, unknown>): TodayReconcileBundle | null {
  const today = body.today;
  if (!today || typeof today !== 'object') return null;
  const t = today as Record<string, unknown>;
  if (typeof t.date !== 'string') return null;
  if (!t.summary || typeof t.summary !== 'object') return null;
  return today as TodayReconcileBundle;
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
  data: WaterDayData,
): void {
  setEntries(data.entries);
}

// ── Context ───────────────────────────────────────────────────────────────────

const WaterContext = createContext<WaterContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function WaterProvider({ children }: { children: React.ReactNode }) {
  const { status, user, updateProfile } = useAuth();

  const [entries,   setEntries]   = useState<WaterEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const goalMl = user?.waterGoalMl ?? DEFAULT_GOAL_ML;

  const goalMlRef = useRef(goalMl);
  const appStateRef = useRef(AppState.currentState);
  const lastForegroundFetchRef = useRef(0);
  const loadInFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  // Mirrors `entries` so mutations can compute the post-change list and write it
  // straight back to the cache without depending on async setState timing.
  const entriesRef = useRef<WaterEntry[]>([]);
  const lastLoadedDateRef = useRef<string>(todayString());

  useEffect(() => { goalMlRef.current = goalMl; }, [goalMl]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  // Persist the current day's entries back into the resource cache. Mutations
  // call this AFTER notifyTodayDataChanged (which invalidates the water key) so
  // the fresh data — not an empty cache — is what a cold start reads.
  const persistWaterCache = useCallback(async (
    date: string,
    nextEntries: WaterEntry[],
  ): Promise<void> => {
    if (!user?.id) return;
    await setResourceCached(
      buildResourceKey('water', user.id, date),
      { entries: nextEntries, goal_ml: goalMlRef.current },
      TTL_WATER_MS,
    );
  }, [user?.id]);

  const totalMl = entries.reduce((s, e) => s + e.amount_ml, 0);
  const sessionActive = hasActiveUserSession(status, user);
  const userId = user?.id;

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

  const fetchWaterDayData = useCallback(async (
    date: string,
    force = false,
  ): Promise<WaterDayData | null> => {
    if (!user?.id) return null;

    const key = buildResourceKey('water', user.id, date);
    return fetchWithResourceCache<WaterDayData>(
      key,
      TTL_WATER_MS,
      () => fetchWaterFromNetwork(date, key),
      { force },
    );
  }, [user?.id, fetchWaterFromNetwork]);

  const loadToday = useCallback(async (
    options?: { force?: boolean },
  ): Promise<void> => {
    if (!user?.id) return;

    const today = todayString();
    const force = options?.force ?? false;
    const key = buildResourceKey('water', user.id, today);
    const inflightKey = `${key}:${force}`;

    if (!force) {
      const cached = await getResourceCached<WaterDayData>(key);
      if (cached) {
        applyDayToState(setEntries, cached.data);
        lastLoadedDateRef.current = today;
        if (!cached.isStale) return;
      }
    }

    const pending = loadInFlightRef.current.get(inflightKey);
    if (pending) {
      await pending;
      return;
    }

    const run = (async () => {
      const data = await fetchWaterDayData(today, force);
      if (data) {
        applyDayToState(setEntries, data);
        lastLoadedDateRef.current = today;
      }
    })().finally(() => {
      loadInFlightRef.current.delete(inflightKey);
    });

    loadInFlightRef.current.set(inflightKey, run);
    await run;
  }, [user?.id, fetchWaterDayData]);

  const fetchForDate = useCallback(async (
    date: string,
    force = false,
  ): Promise<WaterDayData> => {
    const data = await fetchWaterDayData(date, force);
    return data ?? { entries: [], goal_ml: goalMlRef.current };
  }, [fetchWaterDayData]);

  useEffect(() => {
    if (sessionActive) return;
    setEntries([]);
    setIsLoading(false);
    loadInFlightRef.current.clear();
  }, [sessionActive]);

  useEffect(() => {
    if (!sessionActive || !userId) return;

    let cancelled = false;
    (async () => {
      const key = buildResourceKey('water', userId, todayString());
      const cached = await getResourceCached<WaterDayData>(key);
      if (cached && !cancelled) {
        applyDayToState(setEntries, cached.data);
      }
    })();

    return () => { cancelled = true; };
  }, [sessionActive, userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (!prev.match(/inactive|background/) || next !== 'active') return;
      if (!user?.id) return;
      if (
        !shouldRefetchOnForeground({
          lastFetchAt: lastForegroundFetchRef.current,
          dayRolled: lastLoadedDateRef.current !== todayString(),
        })
      ) {
        return;
      }
      lastForegroundFetchRef.current = Date.now();
      void loadToday({ force: false });
    });
    return () => sub.remove();
  }, [user?.id, loadToday]);

  const ensureLoaded = useCallback(
    () => loadToday({ force: false }),
    [loadToday],
  );

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    setIsLoading(true);
    try {
      await loadToday({ force });
      lastForegroundFetchRef.current = Date.now();
    } finally {
      setIsLoading(false);
    }
  }, [loadToday]);

  const commitEntries = useCallback((next: WaterEntry[]): void => {
    entriesRef.current = next;
    setEntries(next);
  }, []);

  const logWater = useCallback(async (amountMl: number): Promise<WaterEntry> => {
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: WaterEntry = {
      id:        optimisticId,
      amount_ml: amountMl,
      logged_at: new Date().toISOString(),
    };
    const targetDate = todayString();
    commitEntries([optimistic, ...entriesRef.current]);

    try {
      const { ok, body } = await apiFetch('/water', {
        method: 'POST',
        body:   JSON.stringify({ amount_ml: amountMl }),
      });
      if (!ok || !body.data) throw new Error('Failed to log water');

      const saved = fromApiEntry(body.data as Record<string, unknown>);
      const next = entriesRef.current.map((e) => (e.id === optimisticId ? saved : e));
      commitEntries(next);
      const bundle = extractTodayBundle(body);
      if (bundle) applyTodayReconcile(bundle);
      const badgesUnlocked = extractBadgesUnlocked(body);
      if (user?.id && badgesUnlocked.length > 0) {
        await applyBadgesUnlocked(user.id, badgesUnlocked);
      }
      // Invalidate dependent caches (summary/insights), then write the fresh
      // entries back so the water cache survives the invalidation.
      await notifyTodayDataChanged(user?.id, 'water', undefined, { badgesUnlocked });
      await persistWaterCache(targetDate, next);
      return saved;
    } catch (err) {
      commitEntries(entriesRef.current.filter((e) => e.id !== optimisticId));
      throw err;
    }
  }, [user?.id, commitEntries, persistWaterCache]);

  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    const targetDate = todayString();
    const next = entriesRef.current.filter((e) => e.id !== id);
    commitEntries(next);
    try {
      const { ok, body } = await apiFetch(`/water/${id}`, { method: 'DELETE' });
      if (!ok) throw new Error('Failed to delete water entry');
      const bundle = extractTodayBundle(body);
      if (bundle) applyTodayReconcile(bundle);
      await notifyTodayDataChanged(user?.id, 'water');
      await persistWaterCache(targetDate, next);
    } catch (err) {
      await loadToday({ force: true });
      throw err;
    }
  }, [user?.id, loadToday, commitEntries, persistWaterCache]);

  const deleteEntryForDate = useCallback(async (date: string, id: string): Promise<void> => {
    if (date === todayString()) {
      await deleteEntry(id);
      return;
    }
    if (!user?.id) return;

    const { ok } = await apiFetch(`/water/${id}`, { method: 'DELETE' });
    if (!ok) throw new Error('Failed to delete water entry');
    await invalidateResourceCache(buildResourceKey('water', user.id, date));
  }, [user?.id, deleteEntry]);

  const setGoal = useCallback(async (ml: number): Promise<void> => {
    const saved = await updateProfile({ waterGoalMl: ml });
    if (!saved) throw new Error('Failed to update water goal');
  }, [updateProfile]);

  return (
    <WaterContext.Provider value={{
      entries, totalMl, goalMl, isLoading,
      logWater, deleteEntry, refresh, fetchForDate, deleteEntryForDate, setGoal, ensureLoaded,
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
