import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  DistanceUnit as WorkoutDistanceUnit,
  LogWorkoutInput,
  WorkoutIntensity,
  WorkoutType,
} from '@/context/workout-context';
import type { DistanceUnit } from '@/utils/units';
import { getLocalDateString } from '@/utils/date';

const DISTANCE_WALKING_RUNNING_ID = 'HKQuantityTypeIdentifierDistanceWalkingRunning';

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
  'HKQuantityTypeIdentifierHeartRate',
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
  'HKCategoryTypeIdentifierAppleStandHour',
] as const;

const WORKOUT_READ_IDS = ['HKWorkoutTypeIdentifier'] as const;

const WORKOUT_SHARE_IDS = ['HKWorkoutTypeIdentifier'] as const;

/** HKWorkoutTypeIdentifier — used for observer + background delivery. */
export const HEALTHKIT_WORKOUT_TYPE_ID = 'HKWorkoutTypeIdentifier';

/** UpdateFrequency.immediate in @kingstinct/react-native-healthkit. */
const HK_UPDATE_FREQUENCY_IMMEDIATE = 1;

const HK_WORKOUT_ACTIVITY_OTHER = 3000;

interface PendingPhoneHealthKitWorkout {
  activityType: number;
  startDate:    Date;
}

let pendingPhoneHealthKitWorkout: PendingPhoneHealthKitWorkout | null = null;

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
  avg_heart_rate:        number | null;
  max_heart_rate:        number | null;
  resting_heart_rate:    number | null;
  hrv:                   number | null;
  sleep_hours:           number;
  deep_sleep_hours:      number;
  rem_sleep_hours:       number;
  sleep_efficiency:      number | null;
  time_in_bed_hours:     number;
  bedtime_iso:           string | null;
  wakeup_iso:            string | null;
  active_minutes:        number;
  stand_hours:           number;
  vo2_max:               number | null;
  mindfulness_minutes:   number;
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
  unit?:           string;
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

export type SleepStage = 'awake' | 'rem' | 'core' | 'deep' | 'unspecified' | 'inBed';

export interface HRVSample {
  time: string; // ISO timestamp
  hrv:  number; // ms SDNN
}

export interface SleepSegment {
  start: Date;
  end:   Date;
  stage: SleepStage;
}

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
    const mod = require('@kingstinct/react-native-healthkit');
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

// ── Authorization ──────────────────────────────────────────────────────────

/** getRequestStatusForAuthorization — already granted for requested types. */
const HK_REQUEST_STATUS_SHOULD_REQUEST = 1;
const HK_REQUEST_STATUS_UNNECESSARY = 2;
/**
 * authorizationStatusFor sharingDenied — only reliable for write/share on a type.
 * Do not use for HKWorkout read gating: read is allowed in Health while write stays denied.
 */
const HK_AUTH_SHARING_DENIED = 1;

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

    let distanceDenied = false;
    if (typeof hk.authorizationStatusFor === 'function') {
      distanceDenied = hk.authorizationStatusFor(DISTANCE_WALKING_RUNNING_ID) === HK_AUTH_SHARING_DENIED;
    }

    if (reqStatus === HK_REQUEST_STATUS_UNNECESSARY && !distanceDenied) return true;
    if (reqStatus !== HK_REQUEST_STATUS_SHOULD_REQUEST && !distanceDenied) return false;

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

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractQuantityFromStatEntry(entry: unknown): { qty: number; unit: string } | null {
  if (entry === null || entry === undefined) return null;

  const direct = asFiniteNumber(entry);
  if (direct !== null && direct > 0) return { qty: direct, unit: '' };

  if (typeof entry !== 'object') return null;
  const nested = entry as Record<string, unknown>;
  const qty = asFiniteNumber(nested.quantity ?? nested.value ?? nested.count);
  if (qty === null || qty <= 0) return null;
  const unit = typeof nested.unit === 'string' ? nested.unit.toLowerCase() : '';
  return { qty, unit };
}

function extractCumulativeFromStatResult(result: unknown): number {
  if (!result || typeof result !== 'object') return 0;
  const raw = result as Record<string, unknown>;
  for (const key of ['sumQuantity', 'cumulativeSum', 'value', 'sum']) {
    const parsed = extractQuantityFromStatEntry(raw[key]);
    if (parsed) return Math.round(parsed.qty);
  }
  return 0;
}

function normaliseDistanceQuantity(qty: number, unit: string): { value: number; unit: DistanceUnit } {
  const u = unit.toLowerCase();
  if (u === 'm' || u === 'meter' || u === 'meters') {
    return { value: Math.round((qty / 1000) * 100) / 100, unit: 'km' };
  }
  if (u === 'mi' || u === 'mile' || u === 'miles') {
    return { value: Math.round(qty * 100) / 100, unit: 'mi' };
  }
  if (u === 'km' || u === 'kilometer' || u === 'kilometers') {
    return { value: Math.round(qty * 100) / 100, unit: 'km' };
  }
  if (u === 'ft' || u === 'foot' || u === 'feet') {
    return { value: Math.round((qty / 5280) * 100) / 100, unit: 'mi' };
  }
  if (u === 'in' || u === 'inch' || u === 'inches') {
    return { value: Math.round((qty / 63360) * 100) / 100, unit: 'mi' };
  }
  if (u === 'yd' || u === 'yard' || u === 'yards') {
    return { value: Math.round((qty / 1760) * 100) / 100, unit: 'mi' };
  }
  // HealthKit's SI default for distance is meters when unit is omitted.
  if (!u && qty >= 100) {
    return { value: Math.round((qty / 1000) * 100) / 100, unit: 'km' };
  }
  return { value: Math.round(qty * 100) / 100, unit: 'km' };
}

/** Official v14 shape: { sumQuantity: { quantity, unit } }. */
function parseSumQuantityFromStatistics(result: unknown): { qty: number; unit: string } | null {
  if (!result || typeof result !== 'object') return null;
  const raw = result as Record<string, unknown>;

  const fromSum = extractQuantityFromStatEntry(raw.sumQuantity);
  if (fromSum) return fromSum;

  for (const key of ['cumulativeSum', 'value', 'sum']) {
    const parsed = extractQuantityFromStatEntry(raw[key]);
    if (parsed) return parsed;
  }

  return extractQuantityFromStatEntry(result);
}

async function preferredDistanceQueryUnits(hk: HealthKitModule): Promise<string[]> {
  const units: string[] = [];
  try {
    if (typeof hk.getPreferredUnit === 'function') {
      const preferred = await hk.getPreferredUnit(DISTANCE_WALKING_RUNNING_ID);
      if (typeof preferred === 'string' && preferred.length > 0) {
        units.push(preferred);
      }
    }
  } catch {
    // fall through to defaults
  }
  for (const u of ['mi', 'km', 'm']) {
    if (!units.includes(u)) units.push(u);
  }
  return units;
}

function warnIfDistanceReadDenied(hk: HealthKitModule): void {
  try {
    if (typeof hk.authorizationStatusFor !== 'function') return;
    const status = hk.authorizationStatusFor(DISTANCE_WALKING_RUNNING_ID);
    // 1 = sharingDenied — user disabled this type in Health › Apps › RoundFit
    if (status === 1) {
      console.warn(
        '[HealthKit] Walking + Running Distance read access denied. '
        + 'Enable it in Settings › Health › Data Access & Devices › RoundFit.',
      );
    }
  } catch {
    // non-fatal
  }
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
  const filter = { date: { startDate, endDate } };
  // Every variant MUST carry `filter.date`. A bare `{ startDate, endDate }` leaves
  // the predicate empty, so HealthKit sums the user's ENTIRE history and returns a
  // lifetime total (e.g. ~11M steps) — which then ratchets in via the backend's
  // Math.max merge. A genuine 0 (no steps yet today) must stay 0, not fall back.
  const optionVariants = [
    { filter },
    { unit: 'count', filter },
    { unit: 'count()', filter },
  ];

  for (const statsOpts of optionVariants) {
    try {
      const result = await hk.queryStatisticsForQuantity(id, ['cumulativeSum'], statsOpts);
      const value = extractCumulativeFromStatResult(result);
      if (value > 0) {
        console.log(`[HealthKit] stat ${id}:`, value);
        return value;
      }
    } catch (e) {
      console.log(`[HealthKit] queryStatisticsForQuantity ${id} failed:`, e);
    }
  }

  return 0;
}

/**
 * Queries distance walking/running and returns the raw value + unit exactly as
 * HealthKit provides them. No unit conversion — the app's profile unit
 * preference controls display. Meters (HealthKit SI default) are normalised to
 * km since that is not a user-facing preference, but mi stays as mi.
 */
async function queryDistanceFromSamples(
  hk:        HealthKitModule,
  startDate: Date,
  endDate:   Date,
  queryUnits: string[],
): Promise<{ value: number; unit: DistanceUnit }> {
  const filter = { date: { startDate, endDate } };
  const unitAttempts = [...queryUnits, undefined];

  for (const unit of unitAttempts) {
    const opts = {
      ...queryOptionsForInterval(startDate, endDate),
      ...(unit ? { unit } : {}),
    };
    try {
      const samples: QuantitySampleLike[] = await hk
        .queryQuantitySamples(DISTANCE_WALKING_RUNNING_ID, opts)
        .catch(() => []);
      let totalMeters = 0;
      let totalKm = 0;
      let totalMi = 0;
      for (const s of samples) {
        const qty = asFiniteNumber(s.quantity);
        if (qty === null || qty <= 0) continue;
        const sampleUnit = s.unit?.toLowerCase() ?? unit?.toLowerCase() ?? '';
        if (sampleUnit === 'mi' || sampleUnit === 'mile' || sampleUnit === 'miles') {
          totalMi += qty;
        } else if (sampleUnit === 'km' || sampleUnit === 'kilometer' || sampleUnit === 'kilometers') {
          totalKm += qty;
        } else if (
          sampleUnit === 'ft' || sampleUnit === 'foot' || sampleUnit === 'feet'
          || sampleUnit === 'in' || sampleUnit === 'inch' || sampleUnit === 'inches'
          || sampleUnit === 'yd' || sampleUnit === 'yard' || sampleUnit === 'yards'
        ) {
          totalMi += sampleUnit.startsWith('in')
            ? qty / 63360
            : sampleUnit.startsWith('yd')
              ? qty / 1760
              : qty / 5280;
        } else {
          totalMeters += qty;
        }
      }
      if (totalMi > 0) {
        return { value: Math.round(totalMi * 100) / 100, unit: 'mi' };
      }
      if (totalKm > 0) {
        return { value: Math.round(totalKm * 100) / 100, unit: 'km' };
      }
      if (totalMeters > 0) {
        return { value: Math.round((totalMeters / 1000) * 100) / 100, unit: 'km' };
      }
    } catch (e) {
      console.log('[HealthKit] queryQuantitySamples distance failed:', e);
    }
  }

  return { value: 0, unit: 'km' };
}

async function queryDistanceStat(
  hk:        HealthKitModule,
  startDate: Date,
  endDate:   Date,
): Promise<{ value: number; unit: DistanceUnit }> {
  warnIfDistanceReadDenied(hk);
  const queryUnits = await preferredDistanceQueryUnits(hk);
  const filter = { date: { startDate, endDate } };

  for (const unit of queryUnits) {
    try {
      const result = await hk.queryStatisticsForQuantity(
        DISTANCE_WALKING_RUNNING_ID,
        ['cumulativeSum'],
        { unit, filter },
      );
      console.log(`[HealthKit] stat raw distance (unit=${unit}):`, JSON.stringify(result));

      const parsed = parseSumQuantityFromStatistics(result);
      if (!parsed) continue;

      const normalised = normaliseDistanceQuantity(parsed.qty, parsed.unit || unit);
      if (normalised.value > 0) {
        console.log(`[HealthKit] distance ${normalised.value} ${normalised.unit}`);
        return normalised;
      }
    } catch (e) {
      console.log(`[HealthKit] queryStatisticsForQuantity distance (unit=${unit}) failed:`, e);
    }
  }

  // User's preferred unit (no explicit unit — HealthKit default, usually meters → mi/km).
  try {
    const result = await hk.queryStatisticsForQuantity(
      DISTANCE_WALKING_RUNNING_ID,
      ['cumulativeSum'],
      { filter },
    );
    console.log('[HealthKit] stat raw distance (preferred):', JSON.stringify(result));
    const parsed = parseSumQuantityFromStatistics(result);
    if (parsed) {
      const normalised = normaliseDistanceQuantity(parsed.qty, parsed.unit);
      if (normalised.value > 0) {
        console.log(`[HealthKit] distance ${normalised.value} ${normalised.unit}`);
        return normalised;
      }
    }
  } catch (e) {
    console.log('[HealthKit] queryStatisticsForQuantity distance (preferred) failed:', e);
  }

  const fromSamples = await queryDistanceFromSamples(hk, startDate, endDate, queryUnits);
  if (fromSamples.value > 0) return fromSamples;
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

  // Stand hours: query a 2-day window (yesterday + today) so HealthKit knows
  // the date range and returns all stand-hour slots for those days.
  // ascending:false means today's records come first (most recent).
  // We still filter to exactly today in JS so the count is always correct.
  const standOpts = {
    limit:     48,
    ascending: false,
    filter: {
      date: {
        startDate: new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1, 0, 0, 0, 0),
        endDate:   new Date(from.getFullYear(), from.getMonth(), from.getDate(),     23, 59, 59, 999),
      },
    },
  };

  // RHR is computed progressively by Apple Watch and may not appear until mid-day.
  // Look back 3 days so early-morning syncs fall back to yesterday's value.
  const rhrOpts = queryOptionsForInterval(
    new Date(from.getFullYear(), from.getMonth(), from.getDate() - 2, 0, 0, 0, 0),
    to,
  );

  // Sleep spans midnight — query from 5pm the previous day to noon today so
  // sessions that start before midnight (e.g. 11pm) are not filtered out.
  const sleepWindowStart = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1, 17, 0, 0, 0);
  const sleepWindowEnd   = new Date(from.getFullYear(), from.getMonth(), from.getDate(),     12, 0, 0, 0);
  const sleepOpts = {
    limit:     2000,
    ascending: true,
    filter:    { date: { startDate: sleepWindowStart, endDate: sleepWindowEnd } },
  };

  console.log('[HealthKit] readDailyHealthKit window:', {
    startDate: from.toISOString(),
    endDate:   to.toISOString(),
  });

  const [
    stepsCount, activeCount, basalCount, distanceStat, exerciseCount,
    heartRateSamples, restingHR, hrv, vo2Max,
    sleep, mindful, standHourSamples,
  ] = await Promise.all([
    stat('HKQuantityTypeIdentifierStepCount'),
    stat('HKQuantityTypeIdentifierActiveEnergyBurned'),
    stat('HKQuantityTypeIdentifierBasalEnergyBurned'),
    queryDistanceStat(hk, from, to),
    stat('HKQuantityTypeIdentifierAppleExerciseTime'),
    q('HKQuantityTypeIdentifierHeartRate'),
    hk.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', rhrOpts).catch(() => []),
    q('HKQuantityTypeIdentifierHeartRateVariabilitySDNN'),
    q('HKQuantityTypeIdentifierVO2Max'),
    hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', sleepOpts).catch(() => []),
    c('HKCategoryTypeIdentifierMindfulSession'),
    hk.queryCategorySamples('HKCategoryTypeIdentifierAppleStandHour', standOpts).catch(() => []),
  ]);

  logHealthKitRawSamples('HeartRate', heartRateSamples);
  logHealthKitRawSamples('RestingHeartRate', restingHR);
  logHealthKitRawSamples('HeartRateVariabilitySDNN', hrv);
  logHealthKitRawSamples('VO2Max', vo2Max);
  console.log('[HealthKit] StandHour raw values:', (standHourSamples as CategorySampleLike[]).slice(0, 10).map((s) => ({
    value: s.value,
    start: s.startDate instanceof Date ? s.startDate.toISOString() : s.startDate,
  })));
  logHealthKitRawSamples('StandHour', standHourSamples);
  logHealthKitRawSamples('SleepAnalysis', sleep);
  logHealthKitRawSamples('MindfulSession', mindful);

  const sleepSummary = summariseSleep(sleep, sleepWindowStart, sleepWindowEnd);

  // Avg and max HR from raw intraday samples
  const hrValues = (heartRateSamples as QuantitySampleLike[])
    .map((s) => s.quantity)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const avgHR = hrValues.length > 0
    ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
    : null;
  const maxHR = hrValues.length > 0 ? Math.round(Math.max(...hrValues)) : null;

  // Stand hours — filter to today in JS (library filter.date is unreliable for
  // category types) then count samples where the user stood during that hour.
  const todayStart = from.getTime();  // midnight of the target day
  const todayEnd   = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 23, 59, 59, 999).getTime();

  const standHours = (standHourSamples as CategorySampleLike[])
    .filter((s) => {
      // Keep only samples whose startDate falls within today
      const sDate = s.startDate instanceof Date ? s.startDate : new Date(s.startDate as string);
      if (Number.isNaN(sDate.getTime())) return false;
      if (sDate.getTime() < todayStart || sDate.getTime() > todayEnd) return false;

      // Count as "stood" — library returns 1 (numeric), 'stood', or full enum string
      const v = s.value;
      if (v === null || v === undefined) return false;
      if (typeof v === 'boolean')  return v;
      if (typeof v === 'number')   return v !== 0;
      if (typeof v === 'string') {
        const lc = v.toLowerCase();
        return !lc.includes('idle') && lc !== '0' && lc !== 'false';
      }
      return false;
    })
    .length;

  const summary: HealthKitSummary = {
    steps:                 stepsCount,
    active_calories:       activeCount,
    resting_calories:      basalCount,
    total_calories_burned: activeCount + basalCount,
    distance:              distanceStat.value,
    distance_unit:         distanceStat.unit,
    avg_heart_rate:        avgHR,
    max_heart_rate:        maxHR,
    resting_heart_rate:    roundOrNull(latest(restingHR)),
    hrv:                   tenthsOrNull(latest(hrv)),
    sleep_hours:           sleepSummary.sleep_hours,
    deep_sleep_hours:      sleepSummary.deep_sleep_hours,
    rem_sleep_hours:       sleepSummary.rem_sleep_hours,
    sleep_efficiency:      sleepSummary.sleep_efficiency,
    time_in_bed_hours:     sleepSummary.time_in_bed_hours,
    bedtime_iso:           sleepSummary.bedtime_iso,
    wakeup_iso:            sleepSummary.wakeup_iso,
    active_minutes:        exerciseCount,
    stand_hours:           standHours,
    vo2_max:               tenthsOrNull(latest(vo2Max)),
    mindfulness_minutes:   round(sumCategoryDurationHoursWithinWindow(mindful, from, to) * 60),
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

/**
 * Reads all HRV (SDNN) samples within a time window, ascending.
 * Used to build the 24-hour stress curve on the Stress screen.
 */
export async function readIntradayHRVSamples(
  hk:   HealthKitModule,
  from: Date,
  to:   Date,
): Promise<HRVSample[]> {
  const opts = {
    limit:     2000,
    ascending: true,
    filter: { date: { startDate: from, endDate: to } },
  };
  try {
    const raw: QuantitySampleLike[] = await hk
      .queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', opts)
      .catch(() => []);
    return raw
      .filter((s) => typeof s.quantity === 'number' && s.quantity > 0)
      .map((s) => ({
        time: (s.startDate instanceof Date ? s.startDate : new Date(s.startDate as string)).toISOString(),
        hrv:  Math.round(s.quantity * 10) / 10,
      }));
  } catch {
    return [];
  }
}

/**
 * Reads raw sleep-stage segments from HealthKit for the night anchored to
 * `dateStr` (treated as the wake-up date). Window: previous day 5 PM → noon.
 * Returns segments with stage classified; `inBed` segments are included so
 * callers can decide whether to display them.
 */
export async function readSleepSegmentsForNight(
  hk:      HealthKitModule,
  dateStr: string,
): Promise<SleepSegment[]> {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const nightStart = new Date(y, (mo ?? 1) - 1, (d ?? 1) - 1, 17, 0, 0, 0);
  const nightEnd   = new Date(y, (mo ?? 1) - 1,  d ?? 1,       12, 0, 0, 0);

  const opts = {
    limit:     2000,
    ascending: true,
    filter:    { date: { startDate: nightStart, endDate: nightEnd } },
  };

  try {
    const raw: CategorySampleLike[] = await hk
      .queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', opts)
      .catch(() => []);

    return raw
      .map((s) => ({
        start: s.startDate instanceof Date ? s.startDate : new Date(s.startDate as string),
        end:   s.endDate   instanceof Date ? s.endDate   : new Date(s.endDate   as string),
        stage: classifySleepStage(s.value),
      }))
      .filter((seg) => seg.end.getTime() > seg.start.getTime());
  } catch {
    return [];
  }
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

function classifySleepStage(value: number | string | null | undefined): SleepStage {
  if (typeof value === 'number') {
    switch (value) {
      case 0: return 'inBed';
      case 2: return 'awake';
      case 3: return 'core';
      case 4: return 'deep';
      case 5: return 'rem';
      default: return 'unspecified';
    }
  }
  if (typeof value === 'string') {
    switch (value) {
      case 'inBed':             return 'inBed';
      case 'awake':             return 'awake';
      case 'asleepCore':        return 'core';
      case 'asleepDeep':        return 'deep';
      case 'asleepREM':         return 'rem';
      case 'asleepUnspecified': return 'unspecified';
      case 'asleep':            return 'unspecified';
    }
  }
  return 'inBed';
}

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
  bedtime_iso:       string | null;
  wakeup_iso:        string | null;
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

  // Track the earliest inBed start and latest inBed end for real bedtime/wakeup
  let inBedStart: Date | null = null;
  let inBedEnd:   Date | null = null;

  for (const s of samples) {
    const hours = durationHoursWithinWindow(s, windowStart, windowEnd);
    if (hours <= 0) continue;
    if (isSleepValue(s.value, SLEEP_VALUE_DEEP, 'asleepDeep')) deep   += hours;
    if (isSleepValue(s.value, SLEEP_VALUE_REM,  'asleepREM'))  rem    += hours;
    if (isAsleepValue(s.value))                                asleep += hours;
    if (isSleepValue(s.value, SLEEP_VALUE_IN_BED, 'inBed')) {
      inBed += hours;
      const start = s.startDate instanceof Date ? s.startDate : new Date(s.startDate);
      const end   = s.endDate   instanceof Date ? s.endDate   : new Date(s.endDate);
      if (!inBedStart || start < inBedStart) inBedStart = start;
      if (!inBedEnd   || end   > inBedEnd)   inBedEnd   = end;
    }
  }

  return {
    sleep_hours:       tenths(asleep),
    deep_sleep_hours:  tenths(deep),
    rem_sleep_hours:   tenths(rem),
    time_in_bed_hours: tenths(inBed),
    sleep_efficiency:  inBed > 0 ? Math.round((asleep / inBed) * 100) : null,
    bedtime_iso:       inBedStart ? inBedStart.toISOString() : null,
    wakeup_iso:        inBedEnd   ? inBedEnd.toISOString()   : null,
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

// ── Workout import ─────────────────────────────────────────────────────────

interface WorkoutQuantityLike {
  quantity?: number;
  unit?:     string;
}

interface WorkoutSampleLike {
  uuid?:                 string;
  id?:                   string;
  workoutActivityType?:  number | string;
  startDate?:            Date | string;
  endDate?:              Date | string;
  duration?:             WorkoutQuantityLike;
  totalEnergyBurned?:    WorkoutQuantityLike;
  totalDistance?:        WorkoutQuantityLike;
  sourceRevision?:       { source?: SourceLike } | null;
  device?:               DeviceLike | null;
  getStatistic?:         (
    quantityType: string,
    unitOverride?: string,
  ) => Promise<{
    averageQuantity?: WorkoutQuantityLike;
    maximumQuantity?: WorkoutQuantityLike;
  } | undefined>;
}

/** Normalised HK workout sample used by the import pipeline. */
export interface HealthKitWorkoutSample {
  uuid:                 string;
  workoutActivityType:  number;
  startDate:            Date;
  endDate:              Date;
  durationSeconds:      number;
  caloriesBurned?:      number;
  distance?:            number;
  distanceUnit?:        WorkoutDistanceUnit;
  avgHeartRate?:        number;
  maxHeartRate?:        number;
  sourceName?:          string;
}

/** Default look-back when no import cursor exists yet. */
export const HEALTHKIT_WORKOUT_DEFAULT_LOOKBACK_DAYS = 30;

/** Start of the standard HealthKit workout scan window (today − lookback days). */
export function buildHealthKitLookbackStart(
  days: number = HEALTHKIT_WORKOUT_DEFAULT_LOOKBACK_DAYS,
): Date {
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - days);
  cursor.setHours(0, 0, 0, 0);
  return cursor;
}

/** Formats duration like Apple Fitness: `0:47:52`. */
export function formatHealthKitWorkoutDurationHms(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(s)}`;
}

export interface HealthKitHeartRatePoint {
  timestamp: Date;
  bpm:       number;
}

export interface HealthKitWorkoutEnergy {
  activeCalories: number;
  totalCalories:  number;
}

/** Finds a normalised HK workout within the lookback window. */
export async function fetchHealthKitWorkoutByUuid(
  uuid: string,
  lookbackDays: number = HEALTHKIT_WORKOUT_DEFAULT_LOOKBACK_DAYS,
): Promise<HealthKitWorkoutSample | null> {
  const workouts = await fetchWorkoutsSince(buildHealthKitLookbackStart(lookbackDays));
  return workouts.find((workout) => workout.uuid === uuid) ?? null;
}

/** Active + total (active + basal) energy during a workout window. */
export async function fetchWorkoutEnergyDuringWindow(
  startDate: Date,
  endDate: Date,
): Promise<HealthKitWorkoutEnergy> {
  const hk = getHealthKitModule();
  if (!hk) return { activeCalories: 0, totalCalories: 0 };

  const authorized = await ensureHealthKitAuthorized(hk);
  if (!authorized) return { activeCalories: 0, totalCalories: 0 };

  const [active, basal] = await Promise.all([
    queryCumulativeStat(hk, 'HKQuantityTypeIdentifierActiveEnergyBurned', startDate, endDate),
    queryCumulativeStat(hk, 'HKQuantityTypeIdentifierBasalEnergyBurned', startDate, endDate),
  ]);

  const activeCalories = Math.round(active);
  const totalCalories = Math.round(active + basal);
  return { activeCalories, totalCalories };
}

/** Heart-rate samples during a workout window (for detail chart). */
export async function fetchHeartRateSamplesDuringWindow(
  startDate: Date,
  endDate: Date,
): Promise<HealthKitHeartRatePoint[]> {
  const hk = getHealthKitModule();
  if (!hk) return [];

  const authorized = await ensureHealthKitAuthorized(hk);
  if (!authorized) return [];

  try {
    const samples = await hk.queryQuantitySamples(
      'HKQuantityTypeIdentifierHeartRate',
      queryOptionsForInterval(startDate, endDate),
    ) as QuantitySampleLike[];

    return samples
      .map((sample) => {
        const start = parseHealthKitDate(sample.startDate);
        const bpm = asFiniteNumber(sample.quantity);
        if (!start || bpm === null || bpm <= 0) return null;
        return { timestamp: start, bpm: Math.round(bpm) };
      })
      .filter((point): point is HealthKitHeartRatePoint => point != null)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch (err) {
    console.log('[HealthKit] fetchHeartRateSamplesDuringWindow failed:', err);
    return [];
  }
}

const HK_ACTIVITY_TO_WORKOUT_TYPE: Record<number, WorkoutType> = {
  13:  'cycling',   // cycling
  16:  'elliptical',
  24:  'walking',   // hiking → walking
  35:  'rowing',
  37:  'running',
  46:  'swimming',
  50:  'gym',       // traditionalStrengthTraining
  20:  'gym',       // functionalStrengthTraining
  52:  'walking',
  57:  'yoga',
  63:  'hiit',      // highIntensityIntervalTraining
};

function parseHealthKitDate(value: Date | string | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function workoutActivityTypeToNumber(value: number | string | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 3000; // WorkoutActivityType.other
}

function durationSecondsFromWorkout(sample: WorkoutSampleLike): number {
  const durationQty = asFiniteNumber(sample.duration?.quantity);
  if (durationQty !== null && durationQty > 0) {
    const unit = sample.duration?.unit?.toLowerCase() ?? 's';
    if (unit === 'min' || unit === 'minute' || unit === 'minutes') {
      return durationQty * 60;
    }
    if (unit === 'h' || unit === 'hr' || unit === 'hour' || unit === 'hours') {
      return durationQty * 3600;
    }
    return durationQty;
  }

  const start = parseHealthKitDate(sample.startDate);
  const end   = parseHealthKitDate(sample.endDate);
  if (!start || !end) return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / 1000);
}

function energyKcalFromWorkout(sample: WorkoutSampleLike): number | undefined {
  const qty = asFiniteNumber(sample.totalEnergyBurned?.quantity);
  if (qty === null || qty <= 0) return undefined;

  const unit = sample.totalEnergyBurned?.unit?.toLowerCase() ?? 'kcal';
  if (unit === 'cal' || unit === 'kilocalorie' || unit === 'kilocalories') {
    return Math.round(qty);
  }
  if (unit === 'kj' || unit === 'kilojoule' || unit === 'kilojoules') {
    return Math.round(qty / 4.184);
  }
  return Math.round(qty);
}

function distanceFromWorkout(
  sample: WorkoutSampleLike,
): { distance?: number; distanceUnit?: WorkoutDistanceUnit } {
  const qty = asFiniteNumber(sample.totalDistance?.quantity);
  if (qty === null || qty <= 0) return {};

  const unit = sample.totalDistance?.unit?.toLowerCase() ?? '';
  const normalised = normaliseDistanceQuantity(qty, unit);
  const distanceUnit: WorkoutDistanceUnit = normalised.unit === 'mi' ? 'miles' : 'km';
  return { distance: normalised.value, distanceUnit };
}

function heartRateFromStatistic(
  stats: { averageQuantity?: WorkoutQuantityLike; maximumQuantity?: WorkoutQuantityLike } | undefined,
): { avgHeartRate?: number; maxHeartRate?: number } {
  if (!stats) return {};

  const avg = asFiniteNumber(stats.averageQuantity?.quantity);
  const max = asFiniteNumber(stats.maximumQuantity?.quantity);
  return {
    avgHeartRate: avg !== null && avg > 0 ? Math.round(avg) : undefined,
    maxHeartRate: max !== null && max > 0 ? Math.round(max) : undefined,
  };
}

async function heartRateStatsForWorkout(
  sample: WorkoutSampleLike,
): Promise<{ avgHeartRate?: number; maxHeartRate?: number }> {
  if (typeof sample.getStatistic !== 'function') return {};

  try {
    const stats = await sample.getStatistic(
      'HKQuantityTypeIdentifierHeartRate',
      'count/min',
    );
    return heartRateFromStatistic(stats);
  } catch {
    return {};
  }
}

function sourceNameFromWorkout(sample: WorkoutSampleLike): string | undefined {
  return sample.sourceRevision?.source?.name
    ?? sample.device?.name
    ?? sample.device?.model
    ?? undefined;
}

function mapActivityTypeToWorkoutType(activityType: number): WorkoutType {
  return HK_ACTIVITY_TO_WORKOUT_TYPE[activityType] ?? 'other';
}

function inferWorkoutIntensity(sample: HealthKitWorkoutSample): WorkoutIntensity {
  if (sample.avgHeartRate !== undefined && sample.avgHeartRate >= 150) return 'hard';
  if (sample.avgHeartRate !== undefined && sample.avgHeartRate >= 120) return 'moderate';
  return 'light';
}

function workoutUuidFromRaw(raw: WorkoutSampleLike): string {
  if (typeof raw.uuid === 'string' && raw.uuid.length > 0) return raw.uuid;
  if (typeof raw.id === 'string' && raw.id.length > 0) return raw.id;

  const record = raw as Record<string, unknown>;
  for (const key of ['UUID', 'workoutUuid', 'identifier'] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }

  const start = parseHealthKitDate(raw.startDate);
  const end = parseHealthKitDate(raw.endDate);
  if (start && end) {
    return `hk-${start.getTime()}-${end.getTime()}`;
  }

  return '';
}

async function normalizeWorkoutSample(
  raw: WorkoutSampleLike,
): Promise<HealthKitWorkoutSample | null> {
  const uuid = workoutUuidFromRaw(raw);
  const startDate = parseHealthKitDate(raw.startDate);
  const endDate = parseHealthKitDate(raw.endDate);
  if (!uuid || !startDate || !endDate) return null;

  const durationSeconds = Math.max(1, durationSecondsFromWorkout(raw));

  const heartRate = await heartRateStatsForWorkout(raw);
  const distance = distanceFromWorkout(raw);

  return {
    uuid,
    workoutActivityType: workoutActivityTypeToNumber(raw.workoutActivityType),
    startDate,
    endDate,
    durationSeconds,
    caloriesBurned: energyKcalFromWorkout(raw),
    distance: distance.distance,
    distanceUnit: distance.distanceUnit,
    avgHeartRate: heartRate.avgHeartRate,
    maxHeartRate: heartRate.maxHeartRate,
    sourceName: sourceNameFromWorkout(raw),
  };
}

/**
 * Queries HKWorkout samples with `startDate >= cursor`, ascending.
 * Enriches each sample with heart-rate statistics when the native proxy supports it.
 */
export async function fetchWorkoutsSince(cursor: Date): Promise<HealthKitWorkoutSample[]> {
  const hk = getHealthKitModule();
  if (!hk) return [];

  const authorized = await ensureHealthKitAuthorized(hk);
  if (!authorized) return [];

  const queryWorkoutSamples = hk.queryWorkoutSamples;
  if (typeof queryWorkoutSamples !== 'function') {
    console.log('[HealthKit] queryWorkoutSamples unavailable on native module');
    return [];
  }

  const endDate = new Date();
  let rawWorkouts: WorkoutSampleLike[] = [];
  try {
    rawWorkouts = await queryWorkoutSamples({
      filter: {
        date: {
          startDate: cursor,
          endDate,
        },
      },
      limit:     0,
      ascending: true,
    });
  } catch (err) {
    console.log('[HealthKit] queryWorkoutSamples failed:', err);
    return [];
  }

  console.log(`[HealthKit] fetchWorkoutsSince: ${rawWorkouts.length} workout(s) since ${cursor.toISOString()}`);
  if (rawWorkouts.length === 0) {
    console.log('[HealthKit] No workouts returned. Check Health → RoundFit → Workouts is enabled.');
  }

  const normalized: HealthKitWorkoutSample[] = [];
  for (const raw of rawWorkouts) {
    const sample = await normalizeWorkoutSample(raw);
    if (sample) normalized.push(sample);
  }

  if (rawWorkouts.length > 0 && normalized.length === 0) {
    const preview = rawWorkouts[0] as Record<string, unknown>;
    console.log(
      '[HealthKit] fetchWorkoutsSince: raw samples did not normalize — keys:',
      Object.keys(preview).join(', '),
    );
  }
  console.log(
    `[HealthKit] fetchWorkoutsSince: ${rawWorkouts.length} raw → ${normalized.length} normalized`,
  );

  return normalized;
}

const SESSION_WORKOUT_OVERLAP_SLACK_MS = 2 * 60 * 1000;

function workoutOverlapsSessionWindow(
  workout: HealthKitWorkoutSample,
  sessionStartedAt: Date,
  now: Date,
): boolean {
  const sessionStartMs = sessionStartedAt.getTime() - SESSION_WORKOUT_OVERLAP_SLACK_MS;
  const nowMs = now.getTime();
  const workoutStartMs = workout.startDate.getTime();
  const workoutEndMs = workout.endDate.getTime();
  return workoutStartMs <= nowMs && workoutEndMs >= sessionStartMs;
}

function pickBestOverlappingWorkout(
  workouts: HealthKitWorkoutSample[],
  sessionStartedAt: Date,
  now: Date,
): HealthKitWorkoutSample | null {
  const overlapping = workouts.filter((w) =>
    workoutOverlapsSessionWindow(w, sessionStartedAt, now),
  );
  if (overlapping.length === 0) return null;

  overlapping.sort((a, b) => {
    const aDelta = Math.abs(a.startDate.getTime() - sessionStartedAt.getTime());
    const bDelta = Math.abs(b.startDate.getTime() - sessionStartedAt.getTime());
    return aDelta - bDelta;
  });

  return overlapping[0] ?? null;
}

/**
 * Finds an HKWorkout bound to the live session — by stored uuid or time overlap.
 * Used by the session metrics engine (Phase C) to prefer workout-scoped kcal / HR.
 */
export async function getActiveHealthKitWorkout(
  sessionStartedAt: Date,
  boundUuid?: string | null,
): Promise<HealthKitWorkoutSample | null> {
  const hk = getHealthKitModule();
  if (!hk) return null;

  const authorized = await ensureHealthKitAuthorized(hk);
  if (!authorized) return null;

  const cursor = new Date(sessionStartedAt.getTime() - SESSION_WORKOUT_OVERLAP_SLACK_MS);
  const workouts = await fetchWorkoutsSince(cursor);
  if (workouts.length === 0) return null;

  if (boundUuid) {
    const bound = workouts.find((w) => w.uuid === boundUuid);
    if (bound) return bound;
  }

  return pickBestOverlappingWorkout(workouts, sessionStartedAt, new Date());
}

/** Extracts live metrics from a normalised HK workout sample. */
export function metricsFromHealthKitWorkout(
  workout: HealthKitWorkoutSample,
): {
  caloriesBurned: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
} {
  return {
    caloriesBurned: workout.caloriesBurned ?? 0,
    ...(workout.avgHeartRate != null && workout.avgHeartRate > 0
      ? { avgHeartRate: workout.avgHeartRate }
      : {}),
    ...(workout.maxHeartRate != null && workout.maxHeartRate > 0
      ? { maxHeartRate: workout.maxHeartRate }
      : {}),
  };
}

function resolveWorkoutActivityType(
  activityType: number | string,
  hk: HealthKitModule,
): number {
  if (typeof activityType === 'number' && Number.isFinite(activityType)) {
    return activityType;
  }

  if (typeof activityType === 'string' && activityType.trim() !== '') {
    const numeric = Number(activityType);
    if (Number.isFinite(numeric)) return numeric;

    const enumName = activityType.replace(/^HKWorkoutActivityType/, '');
    const camelKey = enumName.charAt(0).toLowerCase() + enumName.slice(1);
    const enumValue = hk?.WorkoutActivityType?.[camelKey];
    if (typeof enumValue === 'number') return enumValue;
  }

  return HK_WORKOUT_ACTIVITY_OTHER;
}

async function ensureHealthKitWorkoutWriteAuthorized(
  hk: HealthKitModule,
): Promise<boolean> {
  try {
    await hk.requestAuthorization({
      toRead:  HEALTHKIT_READ_IDENTIFIERS,
      toShare: WORKOUT_SHARE_IDS,
    });
    return ensureHealthKitAuthorized(hk);
  } catch (err) {
    console.log('[HealthKit] workout write authorization failed:', err);
    return false;
  }
}

/**
 * Registers a phone live session with HealthKit.
 *
 * @kingstinct/react-native-healthkit v14 does not expose HKWorkoutSession
 * (live phone workout). We store pending start metadata and bind to an
 * overlapping Watch workout when present; the HK sample is written on end via
 * {@link saveWorkoutSample}.
 */
export async function startPhoneHealthKitWorkout(
  activityType: number | string,
  startDate: Date,
): Promise<string | null> {
  const hk = getHealthKitModule();
  if (!hk) return null;

  const authorized = await ensureHealthKitAuthorized(hk);
  if (!authorized) return null;

  pendingPhoneHealthKitWorkout = {
    activityType: resolveWorkoutActivityType(activityType, hk),
    startDate,
  };

  try {
    const overlapping = await getActiveHealthKitWorkout(startDate);
    if (overlapping?.uuid) return overlapping.uuid;
  } catch {
    // Non-fatal — metrics fall back to delta / MET until end or Watch bind.
  }

  return null;
}

/**
 * Finalises a phone session HKWorkout via saveWorkoutSample (best-effort).
 * Returns the saved workout UUID when HealthKit write succeeds.
 */
export async function endPhoneHealthKitWorkout(endDate: Date): Promise<string | null> {
  const pending = pendingPhoneHealthKitWorkout;
  pendingPhoneHealthKitWorkout = null;
  if (!pending) return null;

  const hk = getHealthKitModule();
  if (!hk || typeof hk.saveWorkoutSample !== 'function') return null;

  const writeOk = await ensureHealthKitWorkoutWriteAuthorized(hk);
  if (!writeOk) return null;

  let resolvedEnd = endDate;
  if (resolvedEnd.getTime() <= pending.startDate.getTime()) {
    resolvedEnd = new Date(pending.startDate.getTime() + 1000);
  }

  try {
    const saved = await hk.saveWorkoutSample(
      pending.activityType,
      [],
      pending.startDate,
      resolvedEnd,
    );
    const uuid = typeof saved?.uuid === 'string' ? saved.uuid : null;
    if (uuid) {
      console.log('[HealthKit] phone workout saved:', uuid);
    }
    return uuid;
  } catch (err) {
    console.log('[HealthKit] endPhoneHealthKitWorkout failed:', err);
    return null;
  }
}

/** Clears pending phone workout metadata without writing to HealthKit. */
export function cancelPhoneHealthKitWorkout(): void {
  pendingPhoneHealthKitWorkout = null;
}

/**
 * Observer for new HKWorkout samples. Uses subscribeToChanges on
 * HKWorkoutTypeIdentifier when the native module is available.
 */
export function subscribeToWorkoutUpdates(
  onChange: () => void,
): { remove: () => void } | null {
  const hk = getHealthKitModule();
  if (!hk || typeof hk.subscribeToChanges !== 'function') return null;

  return hk.subscribeToChanges(HEALTHKIT_WORKOUT_TYPE_ID, () => {
    onChange();
  });
}

/**
 * Best-effort background delivery for HKWorkoutTypeIdentifier.
 * Requires UIBackgroundModes healthkit + observer entitlement in the native app.
 */
export async function enableWorkoutBackgroundDelivery(): Promise<boolean> {
  const hk = getHealthKitModule();
  if (!hk || typeof hk.enableBackgroundDelivery !== 'function') return false;

  const authorized = await ensureHealthKitAuthorized(hk);
  if (!authorized) return false;

  try {
    return await hk.enableBackgroundDelivery(
      HEALTHKIT_WORKOUT_TYPE_ID,
      HK_UPDATE_FREQUENCY_IMMEDIATE,
    );
  } catch (err) {
    console.log('[HealthKit] enableWorkoutBackgroundDelivery failed:', err);
    return false;
  }
}

// ── Sleep observer + background delivery (daily insight) ───────────────────

/** HKCategoryTypeIdentifierSleepAnalysis — used for observer + background delivery. */
export const HEALTHKIT_SLEEP_TYPE_ID = 'HKCategoryTypeIdentifierSleepAnalysis';

/**
 * Observer for new sleep samples. Fires when the watch writes last night's
 * sleep — including OS background wake-ups once delivery is enabled. Same
 * mechanism as {@link subscribeToWorkoutUpdates}, pointed at sleep.
 */
export function subscribeToSleepUpdates(
  onChange: () => void,
): { remove: () => void } | null {
  const hk = getHealthKitModule();
  if (!hk || typeof hk.subscribeToChanges !== 'function') return null;

  return hk.subscribeToChanges(HEALTHKIT_SLEEP_TYPE_ID, () => {
    onChange();
  });
}

/**
 * Best-effort background delivery for sleep analysis. Lets iOS wake the app
 * when last night's sleep syncs from the watch, even while the app is closed.
 * Requires the com.apple.developer.healthkit.background-delivery entitlement
 * (present in RoundFit.entitlements); silently no-ops when unavailable.
 */
export async function enableSleepBackgroundDelivery(): Promise<boolean> {
  const hk = getHealthKitModule();
  if (!hk || typeof hk.enableBackgroundDelivery !== 'function') return false;

  const authorized = await ensureHealthKitAuthorized(hk);
  if (!authorized) return false;

  try {
    return await hk.enableBackgroundDelivery(
      HEALTHKIT_SLEEP_TYPE_ID,
      HK_UPDATE_FREQUENCY_IMMEDIATE,
    );
  } catch (err) {
    console.log('[HealthKit] enableSleepBackgroundDelivery failed:', err);
    return false;
  }
}

/** Maps a normalised HK workout sample to {@link LogWorkoutInput} for POST /workouts. */
export function mapHealthKitWorkoutToLogInput(
  sample: HealthKitWorkoutSample,
): LogWorkoutInput {
  const durationMins = Math.max(1, Math.round(sample.durationSeconds / 60));
  const sourceLabel = sample.sourceName ?? 'Apple Watch';

  return {
    type:            mapActivityTypeToWorkoutType(sample.workoutActivityType),
    duration_mins:   durationMins,
    intensity:       inferWorkoutIntensity(sample),
    source:          'healthkit',
    calories_burned: sample.caloriesBurned,
    distance:        sample.distance,
    distance_unit:   sample.distanceUnit,
    avg_heart_rate:  sample.avgHeartRate,
    max_heart_rate:  sample.maxHeartRate,
    started_at:      sample.startDate.toISOString(),
    ended_at:        sample.endDate.toISOString(),
    date:            getLocalDateString(sample.startDate),
    healthkit_uuid:  sample.uuid,
    notes:           `Imported from ${sourceLabel}`,
  };
}
