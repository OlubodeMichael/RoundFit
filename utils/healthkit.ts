import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** True in the Expo Go client — Nitro/native HealthKit cannot load there. */
export function isExpoGoEnvironment(): boolean {
  return Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
}

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
  distance:              number;
  distance_unit:         string;
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

interface DeviceLike {
  name?:             string;
  manufacturer?:     string;
  model?:            string;
}

interface SourceLike {
  name?:             string;
  bundleIdentifier?: string;
}

interface QuantitySampleLike {
  quantity:        number;
  startDate?:      Date | string;
  endDate?:        Date | string;
  device?:         DeviceLike | null;
  sourceRevision?: { source?: SourceLike } | null;
}

interface CategorySampleLike  {
  value:           number | string | null | undefined;
  startDate:       Date | string;
  endDate:         Date | string;
  device?:         DeviceLike | null;
  sourceRevision?: { source?: SourceLike } | null;
}
type HealthKitModule = any;

// ── Module loader ──────────────────────────────────────────────────────────

/**
 * Lazily require the native HealthKit module. NitroModules throws if this runs
 * inside Expo Go, so we must never call `require` there — try/catch still logs.
 */
export function getHealthKitModule(): HealthKitModule | null {
  if (Platform.OS !== 'ios') return null;
  if (isExpoGoEnvironment()) return null;
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
 * Queries a cumulative metric via queryStatisticsForQuantity (cumulativeSum).
 * This is what the Health app uses — it deduplicates overlapping samples from
 * multiple sources (iPhone, Watch, third-party apps).
 *
 * Signature: queryStatisticsForQuantity(identifier, options[], filterObj?)
 * The result key for the cumulativeSum option is `sumQuantity` (not `cumulativeSum`),
 * and its value is a HKQuantity object { quantity: N, unit: '...' }.
 */
async function queryCumulativeStat(
  hk:        HealthKitModule,
  id:        string,
  startDate: Date,
  endDate:   Date,
): Promise<number> {
  const statsOpts = { filter: { date: { startDate, endDate } } };
  try {
    const result = await hk.queryStatisticsForQuantity(id, ['cumulativeSum'], statsOpts);
    console.log(`[HealthKit] stat raw ${id}:`, JSON.stringify(result));

    if (result && typeof result === 'object') {
      const raw = result as Record<string, unknown>;

      // Try all known result keys — the library has used different names across versions.
      // Each value may be a flat number or a HKQuantity { quantity: N, unit: '...' }.
      for (const key of ['sumQuantity', 'cumulativeSum', 'value', 'sum']) {
        const entry = raw[key];
        if (entry === null || entry === undefined) continue;

        if (typeof entry === 'number' && entry > 0) {
          console.log(`[HealthKit] stat ${id} [${key}]:`, entry);
          return Math.round(entry);
        }

        if (typeof entry === 'object') {
          const nested = entry as Record<string, unknown>;
          const qty = nested.quantity ?? nested.value;
          if (typeof qty === 'number' && qty > 0) {
            console.log(`[HealthKit] stat ${id} [${key}.quantity]:`, qty);
            return Math.round(qty);
          }
        }
      }
    }
  } catch (e) {
    console.log(`[HealthKit] queryStatisticsForQuantity ${id} failed:`, e);
  }

  return 0;
}

/**
 * Queries distance walking/running and returns the raw value + unit exactly as
 * HealthKit provides them. No unit conversion — the app's profile unit
 * preference controls display. Meters (HealthKit SI default) are normalised to
 * km since that is not a user-facing preference, but mi stays as mi.
 */
async function queryDistanceStat(
  hk:        HealthKitModule,
  startDate: Date,
  endDate:   Date,
): Promise<{ value: number; unit: string }> {
  const id        = 'HKQuantityTypeIdentifierDistanceWalkingRunning';
  const statsOpts = { filter: { date: { startDate, endDate } } };
  try {
    const result = await hk.queryStatisticsForQuantity(id, ['cumulativeSum'], statsOpts);
    console.log(`[HealthKit] stat raw ${id}:`, JSON.stringify(result));

    if (result && typeof result === 'object') {
      const raw = result as Record<string, unknown>;

      for (const key of ['sumQuantity', 'cumulativeSum', 'value', 'sum']) {
        const entry = raw[key];
        if (entry === null || entry === undefined) continue;

        let qty: number | null = null;
        let unit = '';

        if (typeof entry === 'number' && entry > 0) {
          qty = entry;
        } else if (typeof entry === 'object') {
          const nested = entry as Record<string, unknown>;
          const q = nested.quantity ?? nested.value;
          if (typeof q === 'number') qty = q;
          if (typeof nested.unit === 'string') unit = nested.unit.toLowerCase();
        }

        if (qty === null || qty <= 0) continue;

        // Normalise meters → km (not a user preference, just a scale issue)
        if (unit === 'm' || unit === 'meter' || unit === 'meters') {
          const km = Math.round((qty / 1000) * 100) / 100;
          console.log(`[HealthKit] distance ${qty} m → ${km} km`);
          return { value: km, unit: 'km' };
        }

        const normUnit = (unit === 'mi' || unit === 'mile' || unit === 'miles') ? 'mi' : 'km';
        const normVal  = Math.round(qty * 100) / 100;
        console.log(`[HealthKit] distance ${normVal} ${normUnit}`);
        return { value: normVal, unit: normUnit };
      }
    }
  } catch (e) {
    console.log(`[HealthKit] queryStatisticsForQuantity ${id} failed:`, e);
  }
  return { value: 0, unit: 'km' };
}

/**
 * Reads every HealthKit metric we use for the given local-time window (`from` → `to`)
 * and returns a flat summary (intended for “today so far”: midnight → now).
 * Cumulative metrics use queryStatisticsForQuantity (no raw-sample summing).
 * Point-in-time metrics (HR, HRV, VO2, weight) use the most recent sample.
 */
export async function readDailyHealthKit(
  hk:   HealthKitModule,
  from: Date,
  to:   Date,
): Promise<HealthKitSummary> {
  const opts = queryOptionsForInterval(from, to);
  const q = (id: string) => hk.queryQuantitySamples(id, opts).catch(() => []);
  const c = (id: string) => hk.queryCategorySamples(id, opts).catch(() => []);
  const stat = (id: string) => queryCumulativeStat(hk, id, from, to);

  console.log('[HealthKit] readDailyHealthKit window:', {
    startDate: from.toISOString(),
    endDate:   to.toISOString(),
  });

  const [
    stepsCount, activeCount, basalCount, distanceStat, exerciseCount,
    restingHR, hrv, vo2Max, bodyMass,
    sleep, mindful,
  ] = await Promise.all([
    stat('HKQuantityTypeIdentifierStepCount'),
    stat('HKQuantityTypeIdentifierActiveEnergyBurned'),
    stat('HKQuantityTypeIdentifierBasalEnergyBurned'),
    queryDistanceStat(hk, from, to),
    stat('HKQuantityTypeIdentifierAppleExerciseTime'),
    q('HKQuantityTypeIdentifierRestingHeartRate'),
    q('HKQuantityTypeIdentifierHeartRateVariabilitySDNN'),
    q('HKQuantityTypeIdentifierVO2Max'),
    q('HKQuantityTypeIdentifierBodyMass'),
    c('HKCategoryTypeIdentifierSleepAnalysis'),
    c('HKCategoryTypeIdentifierMindfulSession'),
  ]);

  logHealthKitRawSamples('RestingHeartRate', restingHR);
  logHealthKitRawSamples('HeartRateVariabilitySDNN', hrv);
  logHealthKitRawSamples('VO2Max', vo2Max);
  logHealthKitRawSamples('BodyMass', bodyMass);
  logHealthKitRawSamples('SleepAnalysis', sleep);
  logHealthKitRawSamples('MindfulSession', mindful);

  const sleepSummary = summariseSleep(sleep, from, to);

  const summary: HealthKitSummary = {
    steps:                 stepsCount,
    active_calories:       activeCount,
    resting_calories:      basalCount,
    total_calories_burned: activeCount + basalCount,
    distance:              distanceStat.value,
    distance_unit:         distanceStat.unit,
    resting_heart_rate:    roundOrNull(latest(restingHR)),
    hrv:                   tenthsOrNull(latest(hrv)),
    sleep_hours:           sleepSummary.sleep_hours,
    deep_sleep_hours:      sleepSummary.deep_sleep_hours,
    rem_sleep_hours:       sleepSummary.rem_sleep_hours,
    sleep_efficiency:      sleepSummary.sleep_efficiency,
    time_in_bed_hours:     sleepSummary.time_in_bed_hours,
    active_minutes:        exerciseCount,
    vo2_max:               tenthsOrNull(latest(vo2Max)),
    mindfulness_minutes:   round(sumCategoryDurationHoursWithinWindow(mindful, from, to) * 60),
    weight_kg:             tenthsOrNull(latest(bodyMass)),
  };

  console.log('[HealthKit] readDailyHealthKit summary (interval above):', JSON.stringify(summary, null, 2));

  return summary;
}

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function dayWindowForDate(dateStr: string): { from: Date; to: Date } {
  const from = parseDateOnly(dateStr);
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export async function readHealthKitForDate(
  hk: HealthKitModule,
  dateStr: string,
): Promise<HealthKitSummary> {
  const { from, to } = dayWindowForDate(dateStr);
  return readDailyHealthKit(hk, from, to);
}

// ── Internal: sample helpers ───────────────────────────────────────────────

// Samples are queried with ascending:false so index 0 is the most recent.
function latest(samples: readonly QuantitySampleLike[]): number | null {
  return samples.length > 0 ? samples[0].quantity : null;
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

function summariseSleep(
  samples: readonly CategorySampleLike[],
  windowStart: Date,
  windowEnd: Date,
): SleepSummary {
  let deep = 0;
  let rem = 0;
  let asleep = 0;
  let inBed = 0;

  for (const s of samples) {
    const hours = durationHoursWithinWindow(s, windowStart, windowEnd);
    if (hours <= 0) continue;
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

function durationHoursWithinWindow(
  s: CategorySampleLike,
  windowStart: Date,
  windowEnd: Date,
): number {
  const start = s.startDate instanceof Date ? s.startDate : new Date(s.startDate);
  const end   = s.endDate   instanceof Date ? s.endDate   : new Date(s.endDate);
  const boundedStart = Math.max(start.getTime(), windowStart.getTime());
  const boundedEnd   = Math.min(end.getTime(), windowEnd.getTime());
  if (boundedEnd <= boundedStart) return 0;
  return (boundedEnd - boundedStart) / 3_600_000;
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

function sumCategoryDurationHoursWithinWindow(
  samples: readonly CategorySampleLike[],
  windowStart: Date,
  windowEnd: Date,
): number {
  return samples.reduce((acc, s) => acc + durationHoursWithinWindow(s, windowStart, windowEnd), 0);
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
  const preview = (samples as QuantitySampleLike[]).slice(0, HK_LOG_PREVIEW).map(s => ({
    quantity:  s.quantity,
    startDate: s.startDate,
    endDate:   s.endDate,
    device:    s.device?.name ?? s.device?.model ?? 'unknown device',
    source:    s.sourceRevision?.source?.name ?? s.sourceRevision?.source?.bundleIdentifier ?? 'unknown source',
  }));
  console.log(`[HealthKit] ${label}: ${n} sample(s), preview (up to ${HK_LOG_PREVIEW}):`, jsonSafe(preview));
}
