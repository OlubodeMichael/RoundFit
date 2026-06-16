import {
  buildHealthKitLookbackStart,
  fetchWorkoutsSince,
  type HealthKitWorkoutSample,
} from '@/utils/healthkit';
import { getLocalDateString } from '@/utils/date';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  invalidateByPrefix,
  peekResourceCached,
} from '@/utils/resource-cache';

export const TTL_HK_WORKOUT_SCAN_MS = 3 * 60 * 1000;
export const TTL_HK_WORKOUT_SAMPLE_MS = 24 * 60 * 60 * 1000;

export interface SerializedHealthKitWorkoutSample {
  uuid: string;
  workoutActivityType: number;
  workoutActivityTypeName?: string;
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

export function serializeHealthKitWorkoutSample(
  sample: HealthKitWorkoutSample,
): SerializedHealthKitWorkoutSample {
  return {
    uuid: sample.uuid,
    workoutActivityType: sample.workoutActivityType,
    workoutActivityTypeName: sample.workoutActivityTypeName,
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

export function deserializeHealthKitWorkoutSample(
  raw: SerializedHealthKitWorkoutSample,
): HealthKitWorkoutSample {
  return {
    uuid: raw.uuid,
    workoutActivityType: raw.workoutActivityType,
    workoutActivityTypeName: raw.workoutActivityTypeName,
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

export function buildHealthKitScanLookbackDateKey(): string {
  return getLocalDateString(buildHealthKitLookbackStart());
}

function buildHealthKitScanCacheKey(userId: string): string {
  return buildResourceKey('hk-workouts-scan', userId, buildHealthKitScanLookbackDateKey());
}

/** Cached raw HealthKit scan for the standard lookback window. */
export async function fetchHealthKitWorkoutsScanCached(
  userId: string,
  force = false,
): Promise<HealthKitWorkoutSample[]> {
  const lookbackStart = buildHealthKitLookbackStart();
  const key = buildHealthKitScanCacheKey(userId);

  const rows = await fetchWithResourceCache<SerializedHealthKitWorkoutSample[]>(
    key,
    TTL_HK_WORKOUT_SCAN_MS,
    async () => {
      const samples = await fetchWorkoutsSince(lookbackStart);
      return samples.map(serializeHealthKitWorkoutSample);
    },
    { force },
  );

  return (rows ?? []).map(deserializeHealthKitWorkoutSample);
}

export async function invalidateHealthKitWorkoutScanCache(userId: string): Promise<void> {
  await invalidateByPrefix(`resource:v2:hk-workouts-scan:${userId}`);
}

function activityTypeFromScanCache(
  userId: string,
  uuid: string,
): number | null {
  const scanKey = buildHealthKitScanCacheKey(userId);
  const samples = peekResourceCached<SerializedHealthKitWorkoutSample[]>(scanKey);
  const hit = samples?.find((sample) => sample.uuid === uuid);
  return hit?.workoutActivityType ?? null;
}

/** Sync read from warmed in-memory HK caches (sample or scan). */
export function peekHealthKitWorkoutActivityType(
  userId: string,
  uuid: string,
): number | null {
  const sampleKey = buildResourceKey('hk-workout-sample', userId, uuid);
  const sample = peekResourceCached<SerializedHealthKitWorkoutSample>(sampleKey);
  if (sample) return sample.workoutActivityType;
  return activityTypeFromScanCache(userId, uuid);
}

/** Async hydration from disk when memory cache is cold. */
export async function resolveHealthKitWorkoutActivityType(
  userId: string,
  uuid: string,
): Promise<number | null> {
  const warm = peekHealthKitWorkoutActivityType(userId, uuid);
  if (warm != null) return warm;

  const sampleKey = buildResourceKey('hk-workout-sample', userId, uuid);
  const cachedSample = await getResourceCached<SerializedHealthKitWorkoutSample>(sampleKey);
  if (cachedSample) return cachedSample.data.workoutActivityType;

  const scanKey = buildHealthKitScanCacheKey(userId);
  const cachedScan = await getResourceCached<SerializedHealthKitWorkoutSample[]>(scanKey);
  const hit = cachedScan?.data.find((sample) => sample.uuid === uuid);
  return hit?.workoutActivityType ?? null;
}
