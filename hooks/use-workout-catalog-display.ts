import { useEffect, useMemo, useState } from 'react';

import { WORKOUT_META } from '@/components/log/workout/workout-display';
import {
  getCatalogEntryForBackendType,
  getCatalogEntryForHealthKitActivity,
  type WorkoutCatalogEntry,
} from '@/config/workout-catalog';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import type { Workout } from '@/context/workout-context';
import { useHealthKitWorkoutByUuid } from '@/hooks/use-healthkit-workout-by-uuid';
import {
  peekHealthKitWorkoutActivityType,
  resolveHealthKitWorkoutActivityType,
} from '@/utils/workout-hk-cache';

export interface WorkoutCatalogDisplay {
  label: string;
  iconEntry: Pick<WorkoutCatalogEntry, 'icon' | 'sfSymbol'>;
  isLoading: boolean;
}

function catalogDisplayFromActivityType(activityType: number): WorkoutCatalogDisplay {
  const entry = getCatalogEntryForHealthKitActivity(activityType);
  return {
    label: entry.label,
    iconEntry: { icon: entry.icon, sfSymbol: entry.sfSymbol },
    isLoading: false,
  };
}

function backendCatalogDisplay(workout: Workout): WorkoutCatalogDisplay {
  const catalogEntry = getCatalogEntryForBackendType(workout.type);
  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.other;

  return {
    label: catalogEntry?.label ?? meta.label,
    iconEntry: catalogEntry
      ? { icon: catalogEntry.icon, sfSymbol: catalogEntry.sfSymbol }
      : { icon: meta.icon, sfSymbol: 'figure.mixed.cardio' },
    isLoading: false,
  };
}

/** Icons and labels aligned with workout detail (HK activity when available). */
export function useWorkoutCatalogDisplay(workout: Workout): WorkoutCatalogDisplay {
  const { status, user } = useAuth();
  const shouldLoadHealthKit =
    workout.source === 'healthkit' && Boolean(workout.healthkit_uuid);
  const healthkitUuid = workout.healthkit_uuid;
  const userId = hasActiveUserSession(status, user) ? user!.id : undefined;

  const [cachedActivityType, setCachedActivityType] = useState<number | null>(() => {
    if (!shouldLoadHealthKit || !healthkitUuid || !userId) return null;
    return peekHealthKitWorkoutActivityType(userId, healthkitUuid);
  });

  useEffect(() => {
    if (!shouldLoadHealthKit || !healthkitUuid || !userId) {
      setCachedActivityType(null);
      return;
    }

    const warm = peekHealthKitWorkoutActivityType(userId, healthkitUuid);
    if (warm != null) {
      setCachedActivityType(warm);
      return;
    }

    let active = true;
    void resolveHealthKitWorkoutActivityType(userId, healthkitUuid).then((activityType) => {
      if (active && activityType != null) {
        setCachedActivityType(activityType);
      }
    });

    return () => {
      active = false;
    };
  }, [shouldLoadHealthKit, healthkitUuid, userId]);

  const { sample, isLoading } = useHealthKitWorkoutByUuid(
    shouldLoadHealthKit ? healthkitUuid : undefined,
  );

  return useMemo(() => {
    const activityType = sample?.workoutActivityType ?? cachedActivityType;

    if (shouldLoadHealthKit && activityType != null) {
      return catalogDisplayFromActivityType(activityType);
    }

    const fallback = backendCatalogDisplay(workout);
    return {
      ...fallback,
      isLoading: shouldLoadHealthKit && isLoading && activityType == null,
    };
  }, [
    shouldLoadHealthKit,
    sample,
    cachedActivityType,
    isLoading,
    workout,
  ]);
}
