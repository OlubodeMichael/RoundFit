import { useCallback, useEffect, useRef, useState } from 'react';

import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import type { Workout } from '@/context/workout-context';
import { useWorkouts } from '@/hooks/use-workouts';
import {
  buildWorkoutSetsCacheKey,
  fetchWorkoutSetsCached,
  findWorkoutByIdCached,
} from '@/utils/workout-cache';
import { getResourceCached } from '@/utils/resource-cache';

export interface UseWorkoutDetailResult {
  workout: Workout | null;
  isLoading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
}

async function loadWorkoutSets(
  userId: string,
  workoutId: string,
  force: boolean,
): Promise<Workout['sets']> {
  const cacheKey = buildWorkoutSetsCacheKey(userId, workoutId);

  if (!force) {
    const cached = await getResourceCached<Workout['sets']>(cacheKey);
    if (cached && !cached.isStale) {
      return cached.data;
    }
  }

  return fetchWorkoutSetsCached(userId, workoutId, force);
}

export function useWorkoutDetail(workoutId: string | undefined): UseWorkoutDetailResult {
  const { status, user } = useAuth();
  const { workouts } = useWorkouts();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;
  const inFlightRef = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (!workoutId || !hasActiveUserSession(status, user)) {
      setWorkout(null);
      setIsLoading(false);
      return;
    }
    if (inFlightRef.current) return;

    const userId = user!.id;
    inFlightRef.current = true;
    setError(null);

    const setsCacheKey = buildWorkoutSetsCacheKey(userId, workoutId);
    const cachedSets = !force ? await getResourceCached<Workout['sets']>(setsCacheKey) : null;
    const fromContext = workoutsRef.current.find((item) => item.id === workoutId) ?? null;

    if (!force && cachedSets && !cachedSets.isStale && fromContext) {
      setWorkout({ ...fromContext, sets: cachedSets.data });
      setIsLoading(false);
      inFlightRef.current = false;
      return;
    }

    if (!force && cachedSets && !cachedSets.isStale) {
      setIsLoading(fromContext == null);
    } else if (!force && fromContext) {
      setWorkout((prev) => prev ?? { ...fromContext, sets: [] });
      setIsLoading(true);
    } else {
      setIsLoading(true);
    }

    try {
      const resolved =
        fromContext ??
        (await findWorkoutByIdCached(userId, workoutId, workoutsRef.current, force));

      if (!resolved) {
        setWorkout(null);
        setError('Workout not found');
        return;
      }

      const sets =
        !force && cachedSets && !cachedSets.isStale
          ? cachedSets.data
          : await loadWorkoutSets(userId, workoutId, force);

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
  }, [refresh]);

  useEffect(() => {
    if (!workoutId) return;
    const fromContext = workouts.find((item) => item.id === workoutId);
    if (!fromContext || fromContext.sets.length === 0) return;

    setWorkout((prev) => {
      if (!prev) return prev;
      if (prev.sets === fromContext.sets) return prev;
      return { ...prev, ...fromContext, sets: fromContext.sets };
    });
  }, [workouts, workoutId]);

  return { workout, isLoading, error, refresh };
}
