import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { getLocalDateString } from '@/utils/date';
import { apiFetch } from '@/utils/api';
import { notifyTodayDataChanged } from '@/utils/today-sync';
import { applyTodayOptimistic } from '@/utils/today-optimistic';
import { applyTodayReconcile, type TodayReconcileBundle } from '@/utils/today-reconcile';
import { shouldRefetchOnForeground } from '@/utils/foreground-refetch';
import {
  buildWorkoutsDateCacheKey,
  fetchWorkoutsForDateCached,
  fromApiSet,
  fromApiWorkout,
  invalidateWorkoutSetsCache,
  patchWorkoutHistoryCache,
  writeWorkoutSetsCache,
} from '@/utils/workout-cache';
import {
  getResourceCached,
  setResourceCached,
  ttlForDate,
} from '@/utils/resource-cache';

// ── Types ──────────────────────────────────────────────────────────────────

/** Backend-canonical workout types */
export type WorkoutType =
  | 'walking' | 'running' | 'cycling' | 'hiit' | 'gym'
  | 'swimming' | 'yoga' | 'rowing' | 'elliptical' | 'other';

/** Maps the screen's UI workout type to the backend type */
export const UI_WORKOUT_TYPE_MAP: Record<string, WorkoutType> = {
  strength: 'gym',
  run:      'running',
  cardio:   'cycling',
  hiit:     'hiit',
  yoga:     'yoga',
  other:    'other',
};

export type WorkoutSource    = 'healthkit' | 'googlefit' | 'manual';
export type WorkoutIntensity = 'light' | 'moderate' | 'hard';
export type WeightUnit       = 'kg' | 'lbs';
export type DistanceUnit     = 'km' | 'miles';

/** Maps the screen's UI intensity to the backend intensity */
export const UI_INTENSITY_MAP: Record<string, WorkoutIntensity> = {
  low:      'light',
  moderate: 'moderate',
  high:     'hard',
  max:      'hard',
};

export interface WorkoutSet {
  id:          string;
  exercise:    string;
  sets?:       number;
  reps?:       number;
  weight?:     number;
  weight_unit: WeightUnit;
}

export interface WorkoutMetrics {
  strain_score?:     number;
  hr_zone_minutes?:  Record<string, number>;
  volume_kg?:        number;
}

export interface Workout {
  id:              string;
  type:            WorkoutType;
  duration_mins:   number;
  calories_burned: number;
  source:          WorkoutSource;
  intensity?:      WorkoutIntensity;
  distance?:       number;
  distance_unit:   DistanceUnit;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  notes?:          string;
  started_at?:     string;
  ended_at?:       string;
  date?:           string;
  healthkit_uuid?: string;
  metrics?:        WorkoutMetrics;
  created_at:      string;
  sets:            WorkoutSet[];
}

export interface LogWorkoutInput {
  type:             WorkoutType;
  duration_mins:    number;
  intensity:        WorkoutIntensity;
  source?:          WorkoutSource;
  calories_burned?: number;
  distance?:        number;
  distance_unit?:   DistanceUnit;
  avg_heart_rate?:  number;
  max_heart_rate?:  number;
  notes?:           string;
  date?:            string;
  started_at?:      string;
  ended_at?:        string;
  healthkit_uuid?:  string;
  metrics?:         WorkoutMetrics;
}

export interface LogSetInput {
  exercise:     string;
  sets?:        number;
  reps?:        number;
  weight?:      number;
  weight_unit?: WeightUnit;
}

export interface WorkoutContextValue {
  workouts:            Workout[];
  isLoading:           boolean;
  totalCaloriesBurned: number;
  historyVersion:      number;
  logWorkout:          (input: LogWorkoutInput) => Promise<Workout>;
  logSets:             (workoutId: string, sets: LogSetInput[]) => Promise<WorkoutSet[]>;
  deleteWorkout:       (id: string) => Promise<void>;
  /** Re-fetches today's workouts. Past-day browsing uses `fetchForDate` locally. */
  refreshWorkouts:     (force?: boolean) => Promise<void>;
  fetchForDate:        (date: string, force?: boolean) => Promise<Workout[]>;
}


// ── Normalisation helpers ──────────────────────────────────────────────────

function todayDateString(): string {
  return getLocalDateString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Pulls the `today` reconciliation block out of a mutation response, if present.
 * Returns null when the backend does not (yet) include it — the legacy
 * `notifyTodayDataChanged` path remains the fallback.
 */
function extractTodayBundle(body: Record<string, unknown>): TodayReconcileBundle | null {
  if (!isPlainObject(body.today)) return null;
  const t = body.today;
  if (typeof t.date !== 'string') return null;
  if (!isPlainObject(t.summary)) return null;
  return body.today as unknown as TodayReconcileBundle;
}

function writeTodayWorkoutsCache(userId: string, rows: Workout[]): void {
  const today = todayDateString();
  void setResourceCached(
    buildWorkoutsDateCacheKey(userId, today),
    rows,
    ttlForDate(today),
  );
}

// ── Context ────────────────────────────────────────────────────────────────

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [workouts,   setWorkouts]   = useState<Workout[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [historyVersion, setHistoryVersion] = useState(0);
  const appStateRef = useRef(AppState.currentState);
  const lastForegroundFetchRef = useRef(0);
  const lastLoadedDateRef = useRef(todayDateString());

  const bumpHistory = useCallback(() => {
    setHistoryVersion((version) => version + 1);
  }, []);

  const totalCaloriesBurned = useMemo(
    () => workouts.reduce((sum, w) => sum + w.calories_burned, 0),
    [workouts],
  );

  const syncToday = useCallback(async () => {
    await notifyTodayDataChanged(user?.id, 'workout');
  }, [user?.id]);

  // ── Fetch workouts ──────────────────────────────────────────────────────
  const fetchWorkouts = useCallback(async (date: string, force = false) => {
    if (!user?.id) return;

    const parsed = await fetchWorkoutsForDateCached(user.id, date, force);
    if (parsed) {
      setWorkouts(parsed);
      lastLoadedDateRef.current = date;
    }
  }, [user?.id]);

  useEffect(() => {
    if (status === 'loading') return;

    if (!hasActiveUserSession(status, user)) {
      setWorkouts([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const today = todayDateString();

    (async () => {
      const key = buildWorkoutsDateCacheKey(user.id, today);
      const cached = await getResourceCached<Workout[]>(key);
      if (cached && !cancelled) {
        setWorkouts(cached.data);
        setIsLoading(false);
      } else if (!cancelled) {
        setIsLoading(true);
      }

      try {
        await fetchWorkouts(today);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchWorkouts]);

  // ── Foreground: roll date or refresh stale today workouts ───────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (!prev.match(/inactive|background/) || next !== 'active') return;

      const today = todayDateString();
      const dayRolled = lastLoadedDateRef.current !== today;
      if (
        !shouldRefetchOnForeground({
          lastFetchAt: lastForegroundFetchRef.current,
          dayRolled,
        })
      ) {
        return;
      }

      lastForegroundFetchRef.current = Date.now();
      void fetchWorkouts(today, dayRolled);
    });
    return () => sub.remove();
  }, [fetchWorkouts]);

  // ── Log workout ──────────────────────────────────────────────────────────
  const logWorkout = useCallback(async (input: LogWorkoutInput): Promise<Workout> => {
    const { ok, body } = await apiFetch('/workouts/', {
      method: 'POST',
      body:   JSON.stringify({ ...input, source: input.source ?? 'manual' }),
    });
    if (!ok) throw new Error((body.error as string) ?? 'Failed to log workout');
    const saved = fromApiWorkout(body.workout as Record<string, unknown>);
    const withClientTimes: Workout = {
      ...saved,
      ...(input.started_at != null ? { started_at: input.started_at } : {}),
      ...(input.ended_at != null ? { ended_at: input.ended_at } : {}),
    };
    setWorkouts((prev) => {
      const next = [withClientTimes, ...prev];
      if (user?.id) writeTodayWorkoutsCache(user.id, next);
      return next;
    });
    if (user?.id) {
      // Await so the patched cache is in place before bumpHistory() re-reads it.
      await patchWorkoutHistoryCache(user.id, (rows) => [withClientTimes, ...rows]);
    }
    applyTodayOptimistic({ caloriesBurned: withClientTimes.calories_burned });
    const bundle = extractTodayBundle(body);
    if (bundle) applyTodayReconcile(bundle);
    bumpHistory();
    void syncToday();
    return withClientTimes;
  }, [bumpHistory, syncToday, user?.id]);

  // ── Log sets ─────────────────────────────────────────────────────────────
  const logSets = useCallback(async (workoutId: string, sets: LogSetInput[]): Promise<WorkoutSet[]> => {
    const { ok, body } = await apiFetch(`/workouts/${workoutId}/sets`, {
      method: 'POST',
      body:   JSON.stringify({ sets }),
    });
    if (!ok) throw new Error((body.error as string) ?? 'Failed to log sets');
    const saved = Array.isArray(body.sets)
      ? (body.sets as Record<string, unknown>[]).map(fromApiSet)
      : [];
    setWorkouts((prev) => {
      const next = prev.map((w) => {
        if (w.id !== workoutId) return w;
        const mergedSets = [...w.sets, ...saved];
        if (user?.id) {
          void writeWorkoutSetsCache(user.id, workoutId, mergedSets);
        }
        return { ...w, sets: mergedSets };
      });
      if (user?.id) writeTodayWorkoutsCache(user.id, next);
      return next;
    });
    const bundle = extractTodayBundle(body);
    if (bundle) applyTodayReconcile(bundle);
    void syncToday();
    return saved;
  }, [syncToday, user?.id]);

  // ── Delete workout ───────────────────────────────────────────────────────
  const deleteWorkout = useCallback(async (id: string) => {
    const snapshot = workouts;
    const removed  = workouts.find((w) => w.id === id);
    setWorkouts((prev) => prev.filter((w) => w.id !== id));

    if (removed) {
      applyTodayOptimistic({ caloriesBurned: -removed.calories_burned });
    }

    const { ok, body } = await apiFetch(`/workouts/${id}`, { method: 'DELETE' });
    if (!ok) {
      setWorkouts(snapshot);
      if (removed) {
        applyTodayOptimistic({ caloriesBurned: removed.calories_burned });
      }
      throw new Error((body.error as string) ?? 'Failed to delete workout');
    }

    if (user?.id) {
      writeTodayWorkoutsCache(user.id, snapshot.filter((workout) => workout.id !== id));
      // Await so the patched cache is in place before bumpHistory() re-reads it.
      await patchWorkoutHistoryCache(user.id, (rows) => rows.filter((w) => w.id !== id));
      void invalidateWorkoutSetsCache(user.id, id);
    }

    const bundle = extractTodayBundle(body);
    if (bundle) applyTodayReconcile(bundle);
    bumpHistory();
    void syncToday();
  }, [bumpHistory, syncToday, user?.id, workouts]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  // `force` defaults true so pull-to-refresh fetches fresh. Pass force=false for
  // cache-first refreshes (e.g. screen focus) so a fresh 2h cache is served
  // without a network round-trip (which otherwise costs a full request even for a 304).
  const refreshWorkouts = useCallback(async (force = true) => {
    await fetchWorkouts(todayDateString(), force);
  }, [fetchWorkouts]);

  // ── Fetch for any date without touching context state ─────────────────────
  const fetchForDate = useCallback(async (date: string, force = false): Promise<Workout[]> => {
    if (!user?.id) return [];
    const parsed = await fetchWorkoutsForDateCached(user.id, date, force);
    return parsed ?? [];
  }, [user?.id]);

  return (
    <WorkoutContext.Provider value={{
      workouts, isLoading, totalCaloriesBurned, historyVersion,
      logWorkout, logSets, deleteWorkout, refreshWorkouts, fetchForDate,
    }}>
      {children}
    </WorkoutContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useWorkouts(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkouts must be used inside <WorkoutProvider>');
  return ctx;
}
