import { useCallback, useEffect, useRef, useState } from 'react';

import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import type { Workout, WorkoutSet } from '@/context/workout-context';
import { useWorkouts } from '@/hooks/use-workouts';
import { apiFetch } from '@/utils/api';

export interface UseWorkoutDetailResult {
  workout: Workout | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function parseApiWorkout(row: Record<string, unknown>): Workout {
  const rawSets = Array.isArray(row.sets) ? row.sets as Record<string, unknown>[] : [];
  return {
    id: String(row.id ?? ''),
    type: (row.type as Workout['type']) ?? 'other',
    duration_mins: typeof row.duration_mins === 'number' ? row.duration_mins : 0,
    calories_burned: typeof row.calories_burned === 'number' ? row.calories_burned : 0,
    source: (row.source as Workout['source']) ?? 'manual',
    intensity: row.intensity as Workout['intensity'],
    distance: typeof row.distance === 'number' ? row.distance : undefined,
    distance_unit: (row.distance_unit as Workout['distance_unit']) ?? 'km',
    avg_heart_rate: typeof row.avg_heart_rate === 'number' ? row.avg_heart_rate : undefined,
    max_heart_rate: typeof row.max_heart_rate === 'number' ? row.max_heart_rate : undefined,
    notes: typeof row.notes === 'string' ? row.notes : undefined,
    started_at: typeof row.started_at === 'string' ? row.started_at : undefined,
    ended_at: typeof row.ended_at === 'string' ? row.ended_at : undefined,
    date: typeof row.date === 'string' ? row.date : undefined,
    healthkit_uuid: typeof row.healthkit_uuid === 'string' ? row.healthkit_uuid : undefined,
    metrics: typeof row.metrics === 'object' && row.metrics != null && !Array.isArray(row.metrics)
      ? row.metrics as Workout['metrics']
      : undefined,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    sets: rawSets.map((set) => ({
      id: String(set.id ?? ''),
      exercise: String(set.exercise ?? ''),
      sets: typeof set.sets === 'number' ? set.sets : undefined,
      reps: typeof set.reps === 'number' ? set.reps : undefined,
      weight: typeof set.weight === 'number' ? set.weight : undefined,
      weight_unit: (set.weight_unit as WorkoutSet['weight_unit']) ?? 'kg',
    })),
  };
}

async function fetchWorkoutSets(workoutId: string): Promise<WorkoutSet[]> {
  const { ok, body } = await apiFetch(`/workouts/${workoutId}/sets`);
  if (!ok) return [];

  const rows = Array.isArray(body.sets) ? body.sets as Record<string, unknown>[] : [];
  return rows.map((set) => ({
    id: String(set.id ?? ''),
    exercise: String(set.exercise ?? ''),
    sets: typeof set.sets === 'number' ? set.sets : undefined,
    reps: typeof set.reps === 'number' ? set.reps : undefined,
    weight: typeof set.weight === 'number' ? set.weight : undefined,
    weight_unit: (set.weight_unit as WorkoutSet['weight_unit']) ?? 'kg',
  }));
}

async function findWorkoutInHistory(workoutId: string): Promise<Workout | null> {
  const { ok, body } = await apiFetch('/workouts/history?limit=50');
  if (!ok) return null;

  const rows = Array.isArray(body.workouts)
    ? body.workouts as Record<string, unknown>[]
    : [];

  const match = rows.find((row) => String(row.id ?? '') === workoutId);
  return match ? parseApiWorkout({ ...match, sets: [] }) : null;
}

export function useWorkoutDetail(workoutId: string | undefined): UseWorkoutDetailResult {
  const { status, user } = useAuth();
  const { workouts, historyVersion } = useWorkouts();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!workoutId || !hasActiveUserSession(status, user)) {
      setWorkout(null);
      setIsLoading(false);
      return;
    }
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      let resolved = workoutsRef.current.find((item) => item.id === workoutId) ?? null;
      if (!resolved) {
        resolved = await findWorkoutInHistory(workoutId);
      }

      if (!resolved) {
        setWorkout(null);
        setError('Workout not found');
        return;
      }

      const sets = resolved.sets?.length
        ? resolved.sets
        : await fetchWorkoutSets(workoutId);

      setWorkout({ ...resolved, sets });
    } catch (err: unknown) {
      setWorkout(null);
      setError(err instanceof Error ? err.message : 'Failed to load workout');
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [status, user, workoutId]);

  useEffect(() => {
    void refresh();
  }, [refresh, historyVersion]);

  return { workout, isLoading, error, refresh };
}
