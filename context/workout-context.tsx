import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useAuth } from '@/context/auth-context';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────

export type WorkoutType =
  | 'run' | 'gym' | 'cycling' | 'hiit' | 'swimming'
  | 'walking' | 'yoga' | 'rowing' | 'elliptical' | 'other';

export type WorkoutSource = 'healthkit' | 'googlefit' | 'manual';
export type WorkoutIntensity = 'low' | 'moderate' | 'high';
export type WeightUnit = 'kg' | 'lbs';
export type DistanceUnit = 'km' | 'miles';

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
  duration:        number;
  calories_burned: number;
  source:          WorkoutSource;
  intensity?:      WorkoutIntensity;
  distance?:       number;
  distance_unit:   DistanceUnit;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  started_at?:     string;
  ended_at?:       string;
  created_at:      string;
  sets:            WorkoutSet[];
}

export interface LogWorkoutInput {
  type:             WorkoutType;
  duration:         number;
  calories_burned:  number;
  source:           WorkoutSource;
  intensity?:       WorkoutIntensity;
  distance?:        number;
  unit?:            'metric' | 'imperial';
  avg_heart_rate?:  number;
  max_heart_rate?:  number;
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
  /** Workouts for the currently selected date. */
  workouts: Workout[];

  /** True while the initial fetch is in-flight. */
  isLoading: boolean;

  /** Total calories burned across all workouts for the selected date. */
  totalCaloriesBurned: number;

  /** Logs a new workout — hits POST /workouts/log. */
  logWorkout: (input: LogWorkoutInput) => Promise<Workout>;

  /** Logs sets for an existing workout — hits POST /workouts/:id/sets. */
  logSets: (workoutId: string, sets: LogSetInput[]) => Promise<WorkoutSet[]>;

  /** Deletes a workout — hits DELETE /workouts/:id. */
  deleteWorkout: (id: string) => Promise<void>;

  /** Re-fetches workouts for the given date (defaults to today). */
  refreshWorkouts: (date?: string) => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────

async function workoutFetch(
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
    duration:        typeof row.duration        === 'number' ? row.duration        : 0,
    calories_burned: typeof row.calories_burned === 'number' ? row.calories_burned : 0,
    source:          (row.source as WorkoutSource) ?? 'manual',
    intensity:       row.intensity  as WorkoutIntensity | undefined,
    distance:        typeof row.distance === 'number' ? row.distance : undefined,
    distance_unit:   (row.distance_unit as DistanceUnit) ?? 'km',
    avg_heart_rate:  typeof row.avg_heart_rate === 'number' ? row.avg_heart_rate : undefined,
    max_heart_rate:  typeof row.max_heart_rate === 'number' ? row.max_heart_rate : undefined,
    started_at:      typeof row.started_at === 'string' ? row.started_at : undefined,
    ended_at:        typeof row.ended_at   === 'string' ? row.ended_at   : undefined,
    created_at:      typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    sets:            rawSets.map(fromApiSet),
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [workouts,  setWorkouts]  = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDate, setActiveDate] = useState(todayDateString);

  const totalCaloriesBurned = useMemo(
    () => workouts.reduce((sum, w) => sum + w.calories_burned, 0),
    [workouts],
  );

  // ── Fetch workouts ──────────────────────────────────────────────────────
  const fetchWorkouts = useCallback(async (date: string) => {
    const { ok, body } = await workoutFetch(`/workouts?date=${date}`);
    if (!ok) return;
    const rows = Array.isArray(body.data) ? body.data as Record<string, unknown>[] : [];
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

  // ── Log workout ──────────────────────────────────────────────────────────
  const logWorkout = useCallback(async (input: LogWorkoutInput): Promise<Workout> => {
    const { ok, body } = await workoutFetch('/workouts/log', {
      method: 'POST',
      body:   JSON.stringify(input),
    });
    if (!ok || !body.data) throw new Error('Failed to log workout');
    const saved = fromApiWorkout(body.data as Record<string, unknown>);
    setWorkouts((prev) => [...prev, saved]);
    return saved;
  }, []);

  // ── Log sets ─────────────────────────────────────────────────────────────
  const logSets = useCallback(async (workoutId: string, sets: LogSetInput[]): Promise<WorkoutSet[]> => {
    const { ok, body } = await workoutFetch(`/workouts/${workoutId}/sets`, {
      method: 'POST',
      body:   JSON.stringify(sets),
    });
    if (!ok || !Array.isArray(body.data)) throw new Error('Failed to log sets');
    const saved = (body.data as Record<string, unknown>[]).map(fromApiSet);
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

    const { ok } = await workoutFetch(`/workouts/${id}`, { method: 'DELETE' });
    if (!ok) {
      setWorkouts(snapshot);
      throw new Error('Failed to delete workout');
    }
  }, [workouts]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refreshWorkouts = useCallback(async (date?: string) => {
    const target = date ?? activeDate;
    if (date && date !== activeDate) setActiveDate(date);
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
