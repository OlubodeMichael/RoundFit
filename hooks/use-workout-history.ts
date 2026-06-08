import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import type { Workout } from '@/context/workout-context';
import { useWorkouts } from '@/hooks/use-workouts';
import { apiFetch } from '@/utils/api';
import { TTL_COLD_START_MS } from '@/utils/daily-summary-cache';
import { getLocalDateString } from '@/utils/date';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
} from '@/utils/resource-cache';

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
      weight_unit: (set.weight_unit as Workout['sets'][0]['weight_unit']) ?? 'kg',
    })),
  };
}

export interface WorkoutHistoryGroup {
  date: string;
  workouts: Workout[];
}

export interface UseWorkoutHistoryResult {
  groups: WorkoutHistoryGroup[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const HISTORY_LIMIT = 30;

export function useWorkoutHistory(): UseWorkoutHistoryResult {
  const { status, user } = useAuth();
  const { historyVersion } = useWorkouts();
  const todayKey = getLocalDateString();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (!hasActiveUserSession(status, user)) {
      setWorkouts([]);
      setIsLoading(false);
      return;
    }
    if (inFlightRef.current) return;

    const userId = user!.id;
    const cacheKey = buildResourceKey('workouts-history', userId, String(HISTORY_LIMIT));

    inFlightRef.current = true;
    setError(null);

    if (!force) {
      const cached = await getResourceCached<Workout[]>(cacheKey);
      if (cached) {
        const parsed = cached.data.filter((workout) => workout.date !== todayKey);
        setWorkouts(parsed);
        setIsLoading(false);
        if (!cached.isStale) {
          inFlightRef.current = false;
          return;
        }
      } else {
        setIsLoading(true);
      }
    } else {
      setIsLoading(true);
    }

    try {
      const rows = await fetchWithResourceCache<Workout[]>(
        cacheKey,
        TTL_COLD_START_MS,
        async () => {
          const { ok, body } = await apiFetch(`/workouts/history?limit=${HISTORY_LIMIT}`);
          if (!ok) {
            throw new Error(typeof body.error === 'string' ? body.error : 'Failed to load workout history');
          }

          const apiRows = Array.isArray(body.workouts)
            ? body.workouts as Record<string, unknown>[]
            : [];

          return apiRows.map(parseApiWorkout);
        },
        { force, allowStale: !force },
      );

      const parsed = (rows ?? []).filter((workout) => workout.date !== todayKey);
      setWorkouts(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load workout history');
      setWorkouts([]);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [status, todayKey, user]);

  useEffect(() => {
    void refresh();
  }, [refresh, historyVersion]);

  const groups = useMemo((): WorkoutHistoryGroup[] => {
    const byDate = new Map<string, Workout[]>();

    for (const workout of workouts) {
      const date = workout.date ?? todayKey;
      const bucket = byDate.get(date);
      if (bucket) {
        bucket.push(workout);
      } else {
        byDate.set(date, [workout]);
      }
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dateWorkouts]) => ({
        date,
        workouts: dateWorkouts.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      }));
  }, [todayKey, workouts]);

  return { groups, isLoading, error, refresh };
}
