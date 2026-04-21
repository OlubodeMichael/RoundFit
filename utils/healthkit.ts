import { Platform } from 'react-native';

// ── Identifiers we request + read ──────────────────────────────────────────

const QUANTITY_READ_IDS = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierHeight',
] as const;

const CATEGORY_READ_IDS = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKCategoryTypeIdentifierMindfulSession',
] as const;

const WORKOUT_READ_IDS = ['HKWorkoutTypeIdentifier'] as const;

/** Every HealthKit type we ask the user to grant read access to. */
export const HEALTHKIT_READ_IDENTIFIERS: readonly string[] = [
  ...QUANTITY_READ_IDS,
  ...CATEGORY_READ_IDS,
  ...WORKOUT_READ_IDS,
];

// ── Types ──────────────────────────────────────────────────────────────────

export interface HealthKitSummary {
  steps:                 number;
  active_calories:       number;
  resting_calories:      number;
  total_calories_burned: number;
  distance_km:           number;
  resting_heart_rate:    number | null;
  hrv:                   number | null;
  sleep_hours:           number;
  deep_sleep_hours:      number;
  rem_sleep_hours:       number;
  sleep_efficiency:      number | null;
  time_in_bed_hours:     number;
  active_minutes:        number;
  vo2_max:               number | null;
  mindfulness_minutes:   number;
  weight_kg:             number | null;
}

interface QuantitySampleLike { quantity: number }
interface CategorySampleLike  {
  value:     number | string | null | undefined;
  startDate: Date | string;
  endDate:   Date | string;
}
type HealthKitModule = any;

// ── Module loader ──────────────────────────────────────────────────────────

/**
 * Lazily require the native HealthKit module. NitroModules crashes Expo Go
 * at import time, so we only load it on demand and swallow the error if the
 * module is unavailable.
 */
export function getHealthKitModule(): HealthKitModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@kingstinct/react-native-healthkit');
  } catch {
    return null;
  }
}

// ── Authorization ──────────────────────────────────────────────────────────

const AUTH_UNNECESSARY   = 2; // permission already granted
const AUTH_SHOULD_REQUEST = 1; // need to prompt the user

/**
 * Ensures the user has granted read access to the HealthKit types we care
 * about. If the status is "unnecessary" (already granted) we return true.
 * If it's "shouldRequest" we prompt and then return true. Any error falls
 * back to false so callers can skip the sync cleanly.
 */
export async function ensureHealthKitAuthorized(
  hk: HealthKitModule,
): Promise<boolean> {
  try {
    const reqStatus = await hk.getRequestStatusForAuthorization({
      toRead: HEALTHKIT_READ_IDENTIFIERS,
    });
    if (reqStatus === AUTH_UNNECESSARY)    return true;
    if (reqStatus !== AUTH_SHOULD_REQUEST) return false;

    await hk.requestAuthorization({ toRead: HEALTHKIT_READ_IDENTIFIERS });
    return true;
  } catch (err) {
    console.log('[HealthKit] authorization check failed:', err);
    return false;
  }
}

// ── Reading daily data ─────────────────────────────────────────────────────

/**
 * @kingstinct/react-native-healthkit uses {@link GenericQueryOptions}:
 * date bounds must live under `filter.date` — **not** top-level `from` / `to`.
 * Omitting `filter` leaves the predicate empty, so HealthKit returns historical
 * samples up to `limit`, which makes sums look like lifetime totals.
 */
function queryOptionsForInterval(
  startDate: Date,
  endDate: Date,
): { limit: number; ascending: boolean; filter: { date: { startDate: Date; endDate: Date } } } {
  return {
    limit:     8000,
    ascending: false,
    filter:    {
      date: { startDate, endDate },
    },
  };
}

/**
 * Reads every HealthKit metric we use for the given local-time window (`from` → `to`)
 * and returns a flat summary (intended for “today so far”: midnight → now).
 * Any individual query failure is isolated — a missing metric becomes null
 * or zero rather than blowing up the whole sync.
 */
export async function readDailyHealthKit(
  hk:   HealthKitModule,
  from: Date,
  to:   Date,
): Promise<HealthKitSummary> {
  const opts = queryOptionsForInterval(from, to);
  const q = (id: string) => hk.queryQuantitySamples(id, opts).catch(() => []);
  const c = (id: string) => hk.queryCategorySamples(id, opts).catch(() => []);

  console.log('[HealthKit] readDailyHealthKit window (filter.date):', {
    startDate: from.toISOString(),
    endDate:   to.toISOString(),
    opts,
  });

  const [
    steps, active, basal, distance,
    restingHR, hrv, vo2Max, exerciseTime, bodyMass,
    sleep, mindful,
  ] = await Promise.all([
    q('HKQuantityTypeIdentifierStepCount'),
    q('HKQuantityTypeIdentifierActiveEnergyBurned'),
    q('HKQuantityTypeIdentifierBasalEnergyBurned'),
    q('HKQuantityTypeIdentifierDistanceWalkingRunning'),
    q('HKQuantityTypeIdentifierRestingHeartRate'),
    q('HKQuantityTypeIdentifierHeartRateVariabilitySDNN'),
    q('HKQuantityTypeIdentifierVO2Max'),
    q('HKQuantityTypeIdentifierAppleExerciseTime'),
    q('HKQuantityTypeIdentifierBodyMass'),
    c('HKCategoryTypeIdentifierSleepAnalysis'),
    c('HKCategoryTypeIdentifierMindfulSession'),
  ]);

  logHealthKitRawSamples('StepCount', steps);
  logHealthKitRawSamples('ActiveEnergyBurned', active);
  logHealthKitRawSamples('BasalEnergyBurned', basal);
  logHealthKitRawSamples('DistanceWalkingRunning', distance);
  logHealthKitRawSamples('RestingHeartRate', restingHR);
  logHealthKitRawSamples('HeartRateVariabilitySDNN', hrv);
  logHealthKitRawSamples('VO2Max', vo2Max);
  logHealthKitRawSamples('AppleExerciseTime', exerciseTime);
  logHealthKitRawSamples('BodyMass', bodyMass);
  logHealthKitRawSamples('SleepAnalysis', sleep);
  logHealthKitRawSamples('MindfulSession', mindful);

  const activeCalories  = round(sumQuantity(active));
  const restingCalories = round(sumQuantity(basal));
  const sleepSummary    = summariseSleep(sleep);

  const summary: HealthKitSummary = {
    steps:                 round(sumQuantity(steps)),
    active_calories:       activeCalories,
    resting_calories:      restingCalories,
    total_calories_burned: activeCalories + restingCalories,
    distance_km:           round((sumQuantity(distance) / 1000) * 100) / 100,
    resting_heart_rate:    roundOrNull(latest(restingHR)),
    hrv:                   tenthsOrNull(latest(hrv)),
    sleep_hours:           sleepSummary.sleep_hours,
    deep_sleep_hours:      sleepSummary.deep_sleep_hours,
    rem_sleep_hours:       sleepSummary.rem_sleep_hours,
    sleep_efficiency:      sleepSummary.sleep_efficiency,
    time_in_bed_hours:     sleepSummary.time_in_bed_hours,
    active_minutes:        round(sumQuantity(exerciseTime)),
    vo2_max:               tenthsOrNull(latest(vo2Max)),
    mindfulness_minutes:   round(sumCategoryDurationHours(mindful) * 60),
    weight_kg:             tenthsOrNull(latest(bodyMass)),
  };

  console.log('[HealthKit] readDailyHealthKit summary (interval above):', JSON.stringify(summary, null, 2));

  return summary;
}

// ── Internal: sample helpers ───────────────────────────────────────────────

function sumQuantity(samples: readonly QuantitySampleLike[]): number {
  return samples.reduce((acc, s) => acc + (s.quantity ?? 0), 0);
}

function latest(samples: readonly QuantitySampleLike[]): number | null {
  return samples.length > 0 ? samples[samples.length - 1].quantity : null;
}

function round(n: number): number {
  return Math.round(n);
}

function roundOrNull(n: number | null): number | null {
  return n === null ? null : Math.round(n);
}

function tenthsOrNull(n: number | null): number | null {
  return n === null ? null : Math.round(n * 10) / 10;
}

// ── Internal: sleep classification ─────────────────────────────────────────

// Apple HKCategoryValueSleepAnalysis numeric values.
// Depending on HealthKit version the lib may return numbers or strings —
// we normalise by checking against both forms.
const SLEEP_VALUE_IN_BED      = 0;
const SLEEP_VALUE_DEEP        = 4;
const SLEEP_VALUE_REM         = 5;
const ASLEEP_VALUES_NUMERIC   = new Set([1, 3, 4, 5]); // unspecified, core, deep, REM

interface SleepSummary {
  sleep_hours:       number;
  deep_sleep_hours:  number;
  rem_sleep_hours:   number;
  time_in_bed_hours: number;
  sleep_efficiency:  number | null;
}

function summariseSleep(samples: readonly CategorySampleLike[]): SleepSummary {
  let deep = 0;
  let rem = 0;
  let asleep = 0;
  let inBed = 0;

  for (const s of samples) {
    const hours = durationHours(s);
    if (isSleepValue(s.value, SLEEP_VALUE_DEEP, 'asleepDeep')) deep   += hours;
    if (isSleepValue(s.value, SLEEP_VALUE_REM,  'asleepREM'))  rem    += hours;
    if (isAsleepValue(s.value))                                asleep += hours;
    if (isSleepValue(s.value, SLEEP_VALUE_IN_BED, 'inBed'))    inBed  += hours;
  }

  return {
    sleep_hours:       tenths(asleep),
    deep_sleep_hours:  tenths(deep),
    rem_sleep_hours:   tenths(rem),
    time_in_bed_hours: tenths(inBed),
    sleep_efficiency:  inBed > 0 ? Math.round((asleep / inBed) * 100) : null,
  };
}

function durationHours(s: CategorySampleLike): number {
  const start = s.startDate instanceof Date ? s.startDate : new Date(s.startDate);
  const end   = s.endDate   instanceof Date ? s.endDate   : new Date(s.endDate);
  return (end.getTime() - start.getTime()) / 3_600_000;
}

function isSleepValue(
  value:     number | string | null | undefined,
  numeric:   number,
  stringTag: string,
): boolean {
  if (typeof value === 'number') return value === numeric;
  if (typeof value === 'string') return value === stringTag;
  return false;
}

function isAsleepValue(value: number | string | null | undefined): boolean {
  if (typeof value === 'number') return ASLEEP_VALUES_NUMERIC.has(value);
  if (typeof value === 'string') return value.startsWith('asleep');
  return false;
}

function sumCategoryDurationHours(samples: readonly CategorySampleLike[]): number {
  return samples.reduce((acc, s) => acc + durationHours(s), 0);
}

function tenths(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── Debug logging (raw HealthKit query results) ───────────────────────────

const HK_LOG_PREVIEW = 8;

function jsonSafe(value: unknown): string {
  try {
    return JSON.stringify(
      value,
      (_, v) => (v instanceof Date ? v.toISOString() : v),
      2,
    );
  } catch {
    return String(value);
  }
}

function logHealthKitRawSamples(label: string, samples: readonly unknown[]): void {
  const n = samples.length;
  const preview = samples.slice(0, HK_LOG_PREVIEW);
  console.log(`[HealthKit] ${label}: ${n} sample(s), preview (up to ${HK_LOG_PREVIEW}):`, jsonSafe(preview));
}
