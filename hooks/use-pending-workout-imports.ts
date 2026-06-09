import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { useWorkouts } from '@/hooks/use-workouts';
import {
  countTodayWorkoutSessions,
  sumTodayWorkoutCalories,
  sumTodayWorkoutDurationMinutes,
} from '@/components/log/workout/workout-display';
import type { WorkoutImportReviewItem } from '@/services/workout-import';
import { getLocalDateString } from '@/utils/date';
import { fetchPendingAppleFitnessDisplayCached } from '@/utils/workout-cache';

export interface PendingWorkoutGroup {
  date: string;
  items: WorkoutImportReviewItem[];
}

export interface UsePendingWorkoutImportsResult {
  /** Pending HK workouts for today only (legacy). */
  todayPending: WorkoutImportReviewItem[];
  /** All unsaved Apple Fitness workouts, grouped by local date. */
  pendingGroups: PendingWorkoutGroup[];
  totalPending: number;
  /** Today's saved + pending duration (minutes). */
  todayDurationMinutes: number;
  /** Today's saved + pending calories burned. */
  todayCaloriesBurned: number;
  /** Today's saved session count + pending Apple Fitness count. */
  todaySessionCount: number;
  isLoading: boolean;
  refresh: (force?: boolean) => Promise<void>;
}

export function usePendingWorkoutImports(): UsePendingWorkoutImportsResult {
  const { status, user } = useAuth();
  const { workouts, historyVersion } = useWorkouts();
  const [pendingItems, setPendingItems] = useState<WorkoutImportReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;
  const pendingItemsRef = useRef(pendingItems);
  pendingItemsRef.current = pendingItems;
  const inFlightRef = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (Platform.OS !== 'ios' || !hasActiveUserSession(status, user)) {
      setPendingItems([]);
      setIsLoading(false);
      return;
    }
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    const knownUuids = workoutsRef.current
      .map((workout) => workout.healthkit_uuid)
      .filter((uuid): uuid is string => typeof uuid === 'string' && uuid.length > 0);

    if (force || pendingItemsRef.current.length === 0) {
      setIsLoading(true);
    }

    try {
      const items = await fetchPendingAppleFitnessDisplayCached(
        user!.id,
        knownUuids,
        force,
      );
      setPendingItems(items);
    } catch (err) {
      console.log('[WorkoutImport] fetchPendingAppleFitnessDisplayCached failed:', err);
      if (force || pendingItemsRef.current.length === 0) {
        setPendingItems([]);
      }
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [status, user]);

  useEffect(() => {
    void refresh();
  }, [refresh, historyVersion]);

  const todayKey = getLocalDateString();

  const savedCaloriesBurned = workouts.reduce(
    (sum, w) => sum + (w.calories_burned ?? 0),
    0,
  );

  const { todayPending, pendingGroups, totalPending, todayDurationMinutes, todayCaloriesBurned, todaySessionCount } = useMemo(() => {
    const knownUuids = new Set(
      workouts
        .map((workout) => workout.healthkit_uuid)
        .filter((uuid): uuid is string => typeof uuid === 'string' && uuid.length > 0),
    );

    const visible = pendingItems.filter((item) => !knownUuids.has(item.sample.uuid));
    const today = visible.filter(
      (item) => getLocalDateString(item.sample.startDate) === todayKey,
    );

    const byDate = new Map<string, WorkoutImportReviewItem[]>();
    for (const item of visible) {
      const dateKey = getLocalDateString(item.sample.startDate);
      const list = byDate.get(dateKey) ?? [];
      list.push(item);
      byDate.set(dateKey, list);
    }

    const groups: PendingWorkoutGroup[] = [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => ({
        date,
        items: items.sort(
          (a, b) => b.sample.endDate.getTime() - a.sample.endDate.getTime(),
        ),
      }));

    return {
      todayPending: today,
      pendingGroups: groups,
      totalPending: visible.length,
      todayDurationMinutes: sumTodayWorkoutDurationMinutes(workouts, visible, todayKey),
      todayCaloriesBurned: sumTodayWorkoutCalories(
        workouts,
        visible,
        savedCaloriesBurned,
        todayKey,
      ),
      todaySessionCount: countTodayWorkoutSessions(workouts, visible, todayKey),
    };
  }, [pendingItems, todayKey, workouts, savedCaloriesBurned]);

  return {
    todayPending,
    pendingGroups,
    totalPending,
    todayDurationMinutes,
    todayCaloriesBurned,
    todaySessionCount,
    isLoading,
    refresh,
  };
}
