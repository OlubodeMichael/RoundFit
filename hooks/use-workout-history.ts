import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import type { Workout } from '@/context/workout-context';
import { useWorkouts } from '@/hooks/use-workouts';
import { getLocalDateString } from '@/utils/date';
import {
  buildWorkoutsHistoryCacheKey,
  fetchWorkoutHistoryCached,
} from '@/utils/workout-cache';
import { getResourceCached } from '@/utils/resource-cache';

export interface WorkoutHistoryGroup {
  date: string;
  workouts: Workout[];
}

export interface UseWorkoutHistoryResult {
  groups: WorkoutHistoryGroup[];
  isLoading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

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
    const cacheKey = buildWorkoutsHistoryCacheKey(userId);

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
      const rows = await fetchWorkoutHistoryCached(userId, force);
      if (rows != null) {
        setWorkouts(rows.filter((workout) => workout.date !== todayKey));
        setError(null);
      } else if (force) {
        setError('Failed to load workout history');
        setWorkouts([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load workout history');
      if (force) setWorkouts([]);
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
