import { useCallback, useEffect, useState } from 'react';

import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import {
  fetchHealthKitWorkoutByUuid,
  type HealthKitWorkoutSample,
} from '@/utils/healthkit';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
} from '@/utils/resource-cache';
import { TTL_HK_WORKOUT_SAMPLE_MS } from '@/utils/workout-hk-cache';

interface SerializedHealthKitWorkoutSample {
  uuid: string;
  workoutActivityType: number;
  startDate: string;
  endDate: string;
  durationSeconds: number;
  caloriesBurned?: number;
  distance?: number;
  distanceUnit?: HealthKitWorkoutSample['distanceUnit'];
  avgHeartRate?: number;
  maxHeartRate?: number;
  sourceName?: string;
}

function serializeSample(sample: HealthKitWorkoutSample): SerializedHealthKitWorkoutSample {
  return {
    uuid: sample.uuid,
    workoutActivityType: sample.workoutActivityType,
    startDate: sample.startDate.toISOString(),
    endDate: sample.endDate.toISOString(),
    durationSeconds: sample.durationSeconds,
    caloriesBurned: sample.caloriesBurned,
    distance: sample.distance,
    distanceUnit: sample.distanceUnit,
    avgHeartRate: sample.avgHeartRate,
    maxHeartRate: sample.maxHeartRate,
    sourceName: sample.sourceName,
  };
}

function deserializeSample(raw: SerializedHealthKitWorkoutSample): HealthKitWorkoutSample {
  return {
    uuid: raw.uuid,
    workoutActivityType: raw.workoutActivityType,
    startDate: new Date(raw.startDate),
    endDate: new Date(raw.endDate),
    durationSeconds: raw.durationSeconds,
    caloriesBurned: raw.caloriesBurned,
    distance: raw.distance,
    distanceUnit: raw.distanceUnit,
    avgHeartRate: raw.avgHeartRate,
    maxHeartRate: raw.maxHeartRate,
    sourceName: raw.sourceName,
  };
}

export interface UseHealthKitWorkoutByUuidResult {
  sample: HealthKitWorkoutSample | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHealthKitWorkoutByUuid(
  uuid: string | undefined,
): UseHealthKitWorkoutByUuidResult {
  const { status, user } = useAuth();
  const [sample, setSample] = useState<HealthKitWorkoutSample | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (!uuid) {
      setSample(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!hasActiveUserSession(status, user)) {
      setSample(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const userId = user!.id;
    const cacheKey = buildResourceKey('hk-workout-sample', userId, uuid);

    setError(null);

    if (!force) {
      const cached = await getResourceCached<SerializedHealthKitWorkoutSample>(cacheKey);
      if (cached) {
        setSample(deserializeSample(cached.data));
        setIsLoading(false);
        if (!cached.isStale) return;
      } else {
        setIsLoading(true);
      }
    } else {
      setIsLoading(true);
    }

    try {
      const row = await fetchWithResourceCache<SerializedHealthKitWorkoutSample | null>(
        cacheKey,
        TTL_HK_WORKOUT_SAMPLE_MS,
        async () => {
          const found = await fetchHealthKitWorkoutByUuid(uuid);
          return found ? serializeSample(found) : null;
        },
        { force, allowStale: !force },
      );

      if (!row) {
        setSample(null);
        setError('This workout is no longer available in Apple Health.');
        return;
      }

      setSample(deserializeSample(row));
    } catch (err: unknown) {
      setSample(null);
      setError(err instanceof Error ? err.message : 'Failed to load workout from Apple Health');
    } finally {
      setIsLoading(false);
    }
  }, [status, user, uuid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { sample, isLoading, error, refresh };
}
