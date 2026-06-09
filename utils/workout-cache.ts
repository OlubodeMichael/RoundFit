import { getCatalogEntryById } from '@/config/workout-catalog';
import type {
  DistanceUnit,
  WeightUnit,
  Workout,
  WorkoutIntensity,
  WorkoutMetrics,
  WorkoutSet,
  WorkoutSource,
  WorkoutType,
} from '@/context/workout-context';
import {
  fetchAppleFitnessWorkoutsForDisplay,
  type WorkoutImportReviewItem,
} from '@/services/workout-import';
import { apiFetch } from '@/utils/api';
import { TTL_COLD_START_MS } from '@/utils/daily-summary-cache';
import { getLocalDateString, normalizeStoredTimestampForDeviceLocal } from '@/utils/date';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  invalidateByPrefix,
  invalidateResourceCache,
  setResourceCached,
  ttlForDate,
} from '@/utils/resource-cache';
import {
  buildHealthKitScanLookbackDateKey,
  deserializeHealthKitWorkoutSample,
  serializeHealthKitWorkoutSample,
  TTL_HK_WORKOUT_SCAN_MS,
  type SerializedHealthKitWorkoutSample,
} from '@/utils/workout-hk-cache';

export const WORKOUT_HISTORY_LIMIT = 30;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function fromApiSet(row: Record<string, unknown>): WorkoutSet {
  return {
    id: String(row.id ?? ''),
    exercise: String(row.exercise ?? ''),
    sets: typeof row.sets === 'number' ? row.sets : undefined,
    reps: typeof row.reps === 'number' ? row.reps : undefined,
    weight: typeof row.weight === 'number' ? row.weight : undefined,
    weight_unit: (row.weight_unit as WeightUnit) ?? 'kg',
  };
}

/** Normalise a `/workouts/*` API row into a `Workout`. */
export function fromApiWorkout(row: Record<string, unknown>): Workout {
  const rawSets = Array.isArray(row.sets) ? row.sets as Record<string, unknown>[] : [];
  const source = (row.source as WorkoutSource) ?? 'manual';
  const startedAt =
    typeof row.started_at === 'string'
      ? normalizeStoredTimestampForDeviceLocal(row.started_at, source)
      : undefined;
  const endedAt =
    typeof row.ended_at === 'string'
      ? normalizeStoredTimestampForDeviceLocal(row.ended_at, source)
      : undefined;

  return {
    id: String(row.id ?? ''),
    type: (row.type as WorkoutType) ?? 'other',
    duration_mins: typeof row.duration_mins === 'number' ? row.duration_mins : 0,
    calories_burned: typeof row.calories_burned === 'number' ? row.calories_burned : 0,
    source,
    intensity: row.intensity as WorkoutIntensity | undefined,
    distance: typeof row.distance === 'number' ? row.distance : undefined,
    distance_unit: (row.distance_unit as DistanceUnit) ?? 'km',
    avg_heart_rate: typeof row.avg_heart_rate === 'number' ? row.avg_heart_rate : undefined,
    max_heart_rate: typeof row.max_heart_rate === 'number' ? row.max_heart_rate : undefined,
    notes: typeof row.notes === 'string' ? row.notes : undefined,
    started_at: startedAt,
    ended_at: endedAt,
    date: typeof row.date === 'string' ? row.date : undefined,
    healthkit_uuid: typeof row.healthkit_uuid === 'string' ? row.healthkit_uuid : undefined,
    metrics: isPlainObject(row.metrics) ? row.metrics as WorkoutMetrics : undefined,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    sets: rawSets.map(fromApiSet),
  };
}

export function buildWorkoutsDateCacheKey(userId: string, date: string): string {
  return buildResourceKey('workouts', userId, date);
}

export function buildWorkoutsHistoryCacheKey(userId: string): string {
  return buildResourceKey('workouts-history', userId, String(WORKOUT_HISTORY_LIMIT));
}

export function buildWorkoutSetsCacheKey(userId: string, workoutId: string): string {
  return buildResourceKey('workout-sets', userId, workoutId);
}

function buildKnownHealthKitUuidFingerprint(knownUuids: readonly string[]): string {
  if (knownUuids.length === 0) return '0';
  return [...knownUuids].sort().join('|');
}

function buildPendingAppleFitnessDisplayCacheKey(
  userId: string,
  knownUuids: readonly string[],
): string {
  return buildResourceKey(
    'workouts-pending-display',
    userId,
    buildHealthKitScanLookbackDateKey(),
    buildKnownHealthKitUuidFingerprint(knownUuids),
  );
}

interface SerializedWorkoutImportReviewItem {
  sample: SerializedHealthKitWorkoutSample;
  catalogId: string;
  label: string;
  durationMinutes: number;
  caloriesBurned?: number;
  avgHeartRate?: number;
  sourceName?: string;
  isFromWatch: boolean;
}

function serializePendingItem(item: WorkoutImportReviewItem): SerializedWorkoutImportReviewItem {
  return {
    sample: serializeHealthKitWorkoutSample(item.sample),
    catalogId: item.catalogId,
    label: item.label,
    durationMinutes: item.durationMinutes,
    caloriesBurned: item.caloriesBurned,
    avgHeartRate: item.avgHeartRate,
    sourceName: item.sourceName,
    isFromWatch: item.isFromWatch,
  };
}

function deserializePendingItem(raw: SerializedWorkoutImportReviewItem): WorkoutImportReviewItem {
  const catalogEntry = getCatalogEntryById(raw.catalogId);
  if (!catalogEntry) {
    throw new Error(`Missing catalog entry for pending workout: ${raw.catalogId}`);
  }

  return {
    sample: deserializeHealthKitWorkoutSample(raw.sample),
    catalogId: raw.catalogId,
    catalogEntry,
    label: raw.label,
    durationMinutes: raw.durationMinutes,
    caloriesBurned: raw.caloriesBurned,
    avgHeartRate: raw.avgHeartRate,
    sourceName: raw.sourceName,
    isFromWatch: raw.isFromWatch,
  };
}

/** Cached today / past-day workouts from the API. */
export async function fetchWorkoutsForDateCached(
  userId: string,
  date: string,
  force = false,
): Promise<Workout[] | null> {
  const isToday = date === getLocalDateString();
  const path = isToday ? '/workouts/today' : `/workouts/${date}`;
  const key = buildWorkoutsDateCacheKey(userId, date);

  return fetchWithResourceCache<Workout[]>(
    key,
    ttlForDate(date),
    async () => {
      const { ok, body } = await apiFetch(path);
      if (!ok) return null;
      const rows = Array.isArray(body.workouts)
        ? body.workouts as Record<string, unknown>[]
        : [];
      return rows.map(fromApiWorkout);
    },
    { force, allowStale: !force },
  );
}

/** Cached workout history list (excludes today at read time in the hook). */
export async function fetchWorkoutHistoryCached(
  userId: string,
  force = false,
): Promise<Workout[] | null> {
  const key = buildWorkoutsHistoryCacheKey(userId);

  return fetchWithResourceCache<Workout[]>(
    key,
    TTL_COLD_START_MS,
    async () => {
      const { ok, body } = await apiFetch(`/workouts/history?limit=${WORKOUT_HISTORY_LIMIT}`);
      if (!ok) return null;
      const rows = Array.isArray(body.workouts)
        ? body.workouts as Record<string, unknown>[]
        : [];
      return rows.map(fromApiWorkout);
    },
    { force, allowStale: !force },
  );
}

/**
 * Write-through the workout-history cache after a create/delete so the history
 * list (useWorkoutHistory) reflects the change WITHOUT a GET /workouts/history.
 * No-ops when nothing is cached yet — the next cold read fetches fresh anyway.
 */
export async function patchWorkoutHistoryCache(
  userId: string,
  mutate: (rows: Workout[]) => Workout[],
): Promise<void> {
  const key = buildWorkoutsHistoryCacheKey(userId);
  const cached = await getResourceCached<Workout[]>(key);
  if (!cached) return;
  await setResourceCached(key, mutate(cached.data), TTL_COLD_START_MS);
}

/**
 * Cached Apple Fitness imports for the workout log UI.
 * Key includes saved `healthkit_uuid` values so imports disappear after save.
 */
export async function fetchPendingAppleFitnessDisplayCached(
  userId: string,
  knownUuids: readonly string[],
  force = false,
): Promise<WorkoutImportReviewItem[]> {
  const key = buildPendingAppleFitnessDisplayCacheKey(userId, knownUuids);
  const knownSet = new Set(knownUuids);

  const rows = await fetchWithResourceCache<SerializedWorkoutImportReviewItem[]>(
    key,
    TTL_HK_WORKOUT_SCAN_MS,
    async () => {
      const items = await fetchAppleFitnessWorkoutsForDisplay({
        userId,
        forceScan: force,
        isAlreadyImported: (uuid) => knownSet.has(uuid),
      });
      return items.map(serializePendingItem);
    },
    { force, allowStale: !force },
  );

  return (rows ?? []).map(deserializePendingItem);
}

export async function invalidatePendingAppleFitnessDisplayCache(userId: string): Promise<void> {
  await invalidateByPrefix(`resource:v2:workouts-pending-display:${userId}`);
}

/** Cached sets for a single workout (`GET /workouts/:id/sets`). */
export async function fetchWorkoutSetsCached(
  userId: string,
  workoutId: string,
  force = false,
): Promise<WorkoutSet[]> {
  const key = buildWorkoutSetsCacheKey(userId, workoutId);

  const rows = await fetchWithResourceCache<WorkoutSet[]>(
    key,
    TTL_COLD_START_MS,
    async () => {
      const { ok, body } = await apiFetch(`/workouts/${workoutId}/sets`);
      if (!ok) return null;
      const apiRows = Array.isArray(body.sets) ? body.sets as Record<string, unknown>[] : [];
      return apiRows.map(fromApiSet);
    },
    { force, allowStale: false },
  );

  return rows ?? [];
}

export async function writeWorkoutSetsCache(
  userId: string,
  workoutId: string,
  sets: WorkoutSet[],
): Promise<void> {
  await setResourceCached(
    buildWorkoutSetsCacheKey(userId, workoutId),
    sets,
    TTL_COLD_START_MS,
  );
}

export async function invalidateWorkoutSetsCache(
  userId: string,
  workoutId?: string,
): Promise<void> {
  if (workoutId) {
    await invalidateResourceCache(buildWorkoutSetsCacheKey(userId, workoutId));
    return;
  }
  await invalidateByPrefix(`resource:v2:workout-sets:${userId}`);
}

/** Resolve a workout row from today cache, then history cache. */
export async function findWorkoutByIdCached(
  userId: string,
  workoutId: string,
  todayWorkouts: readonly Workout[],
  force = false,
): Promise<Workout | null> {
  const fromToday = todayWorkouts.find((workout) => workout.id === workoutId);
  if (fromToday) return fromToday;

  const history = await fetchWorkoutHistoryCached(userId, force);
  return history?.find((workout) => workout.id === workoutId) ?? null;
}
