import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/context/auth-context';
import { getLocalDateString } from '@/utils/date';
import { apiFetch } from '@/utils/api';

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
  logWorkout:          (input: LogWorkoutInput) => Promise<Workout>;
  logSets:             (workoutId: string, sets: LogSetInput[]) => Promise<WorkoutSet[]>;
  deleteWorkout:       (id: string) => Promise<void>;
  refreshWorkouts:     (date?: string) => Promise<void>;
}


// ── Normalisation helpers ──────────────────────────────────────────────────

function todayDateString(): string {
  return getLocalDateString();
}

function fromApiSet(row: Record<string, unknown>): WorkoutSet {
  return {
    id:          String(row.id ?? ''),
    exercise:    String(row.exercise ?? ''),
    sets:        typeof row.sets   === 'number' ? row.sets   : undefined,
    reps:        typeof row.reps   === 'number' ? row.reps   : undefined,
    weight:      typeof row.weight === 'number' ? row.weight : undefined,
    weight_unit: (row.weight_unit as WeightUnit) ?? 'kg',
  };
}

function fromApiWorkout(row: Record<string, unknown>): Workout {
  const rawSets = Array.isArray(row.sets) ? row.sets as Record<string, unknown>[] : [];
  return {
    id:              String(row.id ?? ''),
    type:            (row.type as WorkoutType) ?? 'other',
    duration_mins:   typeof row.duration_mins === 'number' ? row.duration_mins : 0,
    calories_burned: typeof row.calories_burned === 'number' ? row.calories_burned : 0,
    source:          (row.source as WorkoutSource) ?? 'manual',
    intensity:       row.intensity  as WorkoutIntensity | undefined,
    distance:        typeof row.distance === 'number' ? row.distance : undefined,
    distance_unit:   (row.distance_unit as DistanceUnit) ?? 'km',
    avg_heart_rate:  typeof row.avg_heart_rate === 'number' ? row.avg_heart_rate : undefined,
    max_heart_rate:  typeof row.max_heart_rate === 'number' ? row.max_heart_rate : undefined,
    notes:           typeof row.notes === 'string' ? row.notes : undefined,
    started_at:      typeof row.started_at === 'string' ? row.started_at : undefined,
    ended_at:        typeof row.ended_at   === 'string' ? row.ended_at   : undefined,
    date:            typeof row.date       === 'string' ? row.date       : undefined,
    created_at:      typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    sets:            rawSets.map(fromApiSet),
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [workouts,   setWorkouts]   = useState<Workout[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [activeDate, setActiveDate] = useState(todayDateString);
  const appStateRef = useRef(AppState.currentState);

  const totalCaloriesBurned = useMemo(
    () => workouts.reduce((sum, w) => sum + w.calories_burned, 0),
    [workouts],
  );

  // ── Fetch workouts ──────────────────────────────────────────────────────
  const fetchWorkouts = useCallback(async (date: string) => {
    const isToday = date === todayDateString();
    const path    = isToday ? '/workouts/today' : `/workouts/${date}`;
    const { ok, body } = await apiFetch(path);
    if (!ok) return;
    const rows = Array.isArray(body.workouts)
      ? body.workouts as Record<string, unknown>[]
      : [];
    setWorkouts(rows.map(fromApiWorkout));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setWorkouts([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setWorkouts([]);

    (async () => {
      try {
        await fetchWorkouts(activeDate);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, activeDate, fetchWorkouts]);

  // ── Reset to today when app returns to foreground on a new day ─────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        const today = todayDateString();
        setActiveDate((cur) => {
          if (cur !== today) {
            void fetchWorkouts(today);
            return today;
          }
          return cur;
        });
      }
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
    setWorkouts((prev) => [saved, ...prev]);
    return saved;
  }, []);

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
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId ? { ...w, sets: [...w.sets, ...saved] } : w,
      ),
    );
    return saved;
  }, []);

  // ── Delete workout ───────────────────────────────────────────────────────
  const deleteWorkout = useCallback(async (id: string) => {
    const snapshot = workouts;
    setWorkouts((prev) => prev.filter((w) => w.id !== id));

    const { ok, body } = await apiFetch(`/workouts/${id}`, { method: 'DELETE' });
    if (!ok) {
      setWorkouts(snapshot);
      throw new Error((body.error as string) ?? 'Failed to delete workout');
    }
  }, [workouts]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refreshWorkouts = useCallback(async (date?: string) => {
    const target = date ?? todayDateString();
    if (date && date !== activeDate) setActiveDate(date);
    if (!date && activeDate !== target) setActiveDate(target);
    await fetchWorkouts(target);
  }, [activeDate, fetchWorkouts]);

  return (
    <WorkoutContext.Provider value={{
      workouts, isLoading, totalCaloriesBurned,
      logWorkout, logSets, deleteWorkout, refreshWorkouts,
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
