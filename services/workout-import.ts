import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LogWorkoutInput, Workout } from '@/context/workout-context';
import {
  getCatalogEntryById,
  getCatalogEntryForHealthKitActivity,
  getHealthKitActivityDisplayLabel,
  type WorkoutCatalogEntry,
} from '@/config/workout-catalog';
import {
  buildHealthKitLookbackStart,
  fetchWorkoutsSince,
  HEALTHKIT_WORKOUT_DEFAULT_LOOKBACK_DAYS,
  mapHealthKitWorkoutToLogInput,
  type HealthKitWorkoutSample,
} from '@/utils/healthkit';
import {
  fetchHealthKitWorkoutsScanCached,
  invalidateHealthKitWorkoutScanCache,
} from '@/utils/workout-hk-cache';

export const HEALTHKIT_WORKOUT_CURSOR_KEY = '@roundfit/healthkit_workout_cursor';
export const IMPORTED_UUIDS_KEY = '@roundfit/healthkit_imported_uuids';

export type LogWorkoutFn = (input: LogWorkoutInput) => Promise<Workout>;

export interface WorkoutImportOptions {
  /** Extra client-side dedupe check (e.g. workouts already loaded in context). */
  isAlreadyImported?: (healthkitUuid: string) => boolean;
  /** Override cursor for tests or manual sync. */
  cursorOverride?: Date;
  /** When true, detect new workouts but do not POST — surface via review flow. */
  reviewBeforeImport?: boolean;
  /** Enables cached HealthKit scan when set. */
  userId?: string;
  /** Bypass cached HealthKit scan. */
  forceScan?: boolean;
}

export interface WorkoutImportResult {
  imported:      number;
  skipped:       number;
  failed:        number;
  pending:       number;
  cursor:        string;
  lastSampleAt?: string;
}

/** Review sheet payload for a single HK workout awaiting user confirmation. */
export interface WorkoutImportReviewItem {
  sample:           HealthKitWorkoutSample;
  catalogId:        string;
  catalogEntry:     WorkoutCatalogEntry;
  label:            string;
  durationMinutes:  number;
  caloriesBurned?:  number;
  avgHeartRate?:    number;
  sourceName?:      string;
  isFromWatch:      boolean;
}

export interface WorkoutImportReviewOverrides {
  catalogId?: string;
}

function defaultLookbackCursor(): Date {
  return buildHealthKitLookbackStart(HEALTHKIT_WORKOUT_DEFAULT_LOOKBACK_DAYS);
}

async function fetchWorkoutsSinceCached(
  scanStart: Date,
  options: Pick<WorkoutImportOptions, 'userId' | 'forceScan'> = {},
): Promise<HealthKitWorkoutSample[]> {
  if (options.userId) {
    const samples = await fetchHealthKitWorkoutsScanCached(options.userId, options.forceScan);
    return samples.filter((sample) => sample.endDate.getTime() >= scanStart.getTime());
  }
  return fetchWorkoutsSince(scanStart);
}

async function loadImportCursor(): Promise<Date> {
  try {
    const raw = await AsyncStorage.getItem(HEALTHKIT_WORKOUT_CURSOR_KEY);
    if (!raw) return defaultLookbackCursor();
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return defaultLookbackCursor();
    return parsed;
  } catch {
    return defaultLookbackCursor();
  }
}

async function saveImportCursor(date: Date): Promise<void> {
  await AsyncStorage.setItem(HEALTHKIT_WORKOUT_CURSOR_KEY, date.toISOString());
}

async function loadImportedUuidSet(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(IMPORTED_UUIDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

async function saveImportedUuidSet(uuids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(IMPORTED_UUIDS_KEY, JSON.stringify([...uuids]));
}

function shouldSkipSample(
  sample: HealthKitWorkoutSample,
  importedUuids: Set<string>,
  isAlreadyImported?: (healthkitUuid: string) => boolean,
): boolean {
  if (importedUuids.has(sample.uuid)) return true;
  if (isAlreadyImported?.(sample.uuid)) return true;
  return false;
}

function isWatchSource(sourceName?: string): boolean {
  if (!sourceName) return true;
  const lower = sourceName.toLowerCase();
  return lower.includes('watch') || lower.includes('apple');
}

function mapSampleToReviewItem(sample: HealthKitWorkoutSample): WorkoutImportReviewItem {
  const catalogEntry = getCatalogEntryForHealthKitActivity(sample.workoutActivityType);
  const durationMinutes = Math.max(1, Math.round(sample.durationSeconds / 60));

  return {
    sample,
    catalogId: catalogEntry.id,
    catalogEntry,
    label: getHealthKitActivityDisplayLabel(sample.workoutActivityType),
    durationMinutes,
    caloriesBurned: sample.caloriesBurned,
    avgHeartRate: sample.avgHeartRate,
    sourceName: sample.sourceName,
    isFromWatch: isWatchSource(sample.sourceName),
  };
}

async function markSampleHandled(
  sample: HealthKitWorkoutSample,
  importedUuids: Set<string>,
): Promise<void> {
  importedUuids.add(sample.uuid);
  await saveImportedUuidSet(importedUuids);

  const cursor = await loadImportCursor();
  if (sample.endDate.getTime() > cursor.getTime()) {
    await saveImportCursor(sample.endDate);
  }
}

/**
 * All Apple Fitness workouts in the lookback window for UI display.
 * Does not filter AsyncStorage discard/import markers — only hides rows already saved to the server via `isAlreadyImported`.
 */
export async function fetchAppleFitnessWorkoutsForDisplay(
  options: Pick<WorkoutImportOptions, 'isAlreadyImported' | 'userId' | 'forceScan'> = {},
): Promise<WorkoutImportReviewItem[]> {
  const scanStart = defaultLookbackCursor();
  const samples = await fetchWorkoutsSinceCached(scanStart, options);

  return samples
    .filter((sample) => !options.isAlreadyImported?.(sample.uuid))
    .map(mapSampleToReviewItem)
    .sort((a, b) => b.sample.endDate.getTime() - a.sample.endDate.getTime());
}

/**
 * HK workouts since the persisted cursor that have not been imported or discarded.
 */
export async function fetchPendingWorkoutsForReview(
  options: Pick<WorkoutImportOptions, 'cursorOverride' | 'isAlreadyImported' | 'userId' | 'forceScan'> = {},
): Promise<WorkoutImportReviewItem[]> {
  // Always scan the full lookback window — the import cursor can skip workouts
  // that were never saved/discarded (e.g. after a partial sync).
  const scanStart = options.cursorOverride ?? defaultLookbackCursor();
  const samples = await fetchWorkoutsSinceCached(scanStart, options);
  const importedUuids = await loadImportedUuidSet();

  const pending = samples
    .filter((sample) => !shouldSkipSample(sample, importedUuids, options.isAlreadyImported))
    .map(mapSampleToReviewItem)
    .sort((a, b) => b.sample.endDate.getTime() - a.sample.endDate.getTime());

  return pending;
}

/** Saves a reviewed HK workout via `logWorkout`, optionally overriding the mapped type. */
export async function importReviewedWorkout(
  sample: HealthKitWorkoutSample,
  logWorkout: LogWorkoutFn,
  overrides?: WorkoutImportReviewOverrides,
  userId?: string,
): Promise<Workout> {
  const input = mapHealthKitWorkoutToLogInput(sample);
  const sourceLabel = sample.sourceName ?? 'Apple Watch';

  if (overrides?.catalogId) {
    const entry = getCatalogEntryById(overrides.catalogId);
    if (entry) {
      input.type = entry.backendType;
      input.notes = `Imported from ${sourceLabel} (${entry.label})`;
    }
  }

  const workout = await logWorkout(input);
  const importedUuids = await loadImportedUuidSet();
  await markSampleHandled(sample, importedUuids);
  if (userId) {
    await invalidateHealthKitWorkoutScanCache(userId);
  }
  return workout;
}

/** Marks a HK workout as handled without creating a RoundFit row. */
export async function discardReviewedWorkout(
  sample: HealthKitWorkoutSample,
  userId?: string,
): Promise<void> {
  const importedUuids = await loadImportedUuidSet();
  await markSampleHandled(sample, importedUuids);
  if (userId) {
    await invalidateHealthKitWorkoutScanCache(userId);
  }
}

/**
 * Pulls HK workouts since the persisted cursor, dedupes by `healthkit_uuid`,
 * and logs new rows via the injected `logWorkout` callback from workout-context.
 *
 * When `reviewBeforeImport` is true, new samples are counted as `pending` instead
 * of being POSTed — use `fetchPendingWorkoutsForReview` + `importReviewedWorkout`.
 */
export async function runWorkoutImport(
  logWorkout: LogWorkoutFn,
  options: WorkoutImportOptions = {},
): Promise<WorkoutImportResult> {
  const cursor = options.cursorOverride ?? await loadImportCursor();
  const samples = await fetchWorkoutsSinceCached(cursor, options);
  const importedUuids = await loadImportedUuidSet();

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let pending = 0;
  let latestEndDate = cursor;

  for (const sample of samples) {
    if (shouldSkipSample(sample, importedUuids, options.isAlreadyImported)) {
      skipped += 1;
      if (sample.endDate.getTime() > latestEndDate.getTime()) {
        latestEndDate = sample.endDate;
      }
      continue;
    }

    if (options.reviewBeforeImport) {
      pending += 1;
      if (sample.endDate.getTime() > latestEndDate.getTime()) {
        latestEndDate = sample.endDate;
      }
      continue;
    }

    try {
      await logWorkout(mapHealthKitWorkoutToLogInput(sample));
      importedUuids.add(sample.uuid);
      imported += 1;
    } catch {
      failed += 1;
    }

    if (sample.endDate.getTime() > latestEndDate.getTime()) {
      latestEndDate = sample.endDate;
    }
  }

  if (samples.length > 0 && !options.reviewBeforeImport) {
    await saveImportCursor(latestEndDate);
  }
  if (!options.reviewBeforeImport) {
    await saveImportedUuidSet(importedUuids);
  }

  if (options.userId && !options.reviewBeforeImport && imported > 0) {
    await invalidateHealthKitWorkoutScanCache(options.userId);
  }

  return {
    imported,
    skipped,
    failed,
    pending,
    cursor: latestEndDate.toISOString(),
    lastSampleAt: samples.at(-1)?.endDate.toISOString(),
  };
}
