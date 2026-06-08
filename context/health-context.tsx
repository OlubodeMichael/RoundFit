import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { apiFetch, proactiveRefreshIfNeeded } from '@/utils/api';
import {
  ensureHealthKitAuthorized,
  getHealthKitModule,
  readHealthKitForDate,
  readDailyHealthKit,
  type HealthKitSummary,
} from '@/utils/healthkit';
import { getLocalDateString } from '@/utils/date';
import { localSleepDateString } from '@/utils/sleep-date';
import { mergePriorDaySleepIntoHealth } from '@/utils/sleep-display';
import { notifyTodayDataChanged } from '@/utils/today-sync';
import { applyTodayReconcile, type TodayReconcileBundle } from '@/utils/today-reconcile';
import { registerHealthReconcileListener } from '@/utils/today-health-reconcile';
import {
  buildResourceKey,
  fetchWithResourceCache,
  getResourceCached,
  setResourceCached,
  ttlForDate,
} from '@/utils/resource-cache';

// ── Config ─────────────────────────────────────────────────────────────────

const HEALTH_BACKFILL_CURSOR_KEY = '@roundfit/health_backfill_cursor';
export const LAST_HEALTH_SYNC_KEY = '@roundfit/last_health_sync';
/** Throttle expensive per-day backfill only — today's HK read always runs. */
const HEALTH_BACKFILL_THROTTLE_MS = 3 * 60 * 1000;

/** Per-day fingerprint of the last successfully-synced payload — gates redundant POSTs. */
const HEALTH_SIG_KEY_PREFIX = '@roundfit/health_sig';
const healthSigStorageKey = (date: string) => `${HEALTH_SIG_KEY_PREFIX}:${date}`;
/** Re-read today's steps/calories while the app stays in the foreground. */
const HEALTH_TODAY_POLL_MS = 60 * 1000;

// ── Types ──────────────────────────────────────────────────────────────────

export type HealthSource = 'healthkit' | 'googlefit' | 'manual';

export interface HealthData {
  id:                    string;
  active_calories:       number;
  resting_calories:      number;
  total_calories_burned: number;
  steps:                 number;
  distance:              number;
  distance_unit:         string;
  avg_heart_rate:        number | null;
  max_heart_rate:        number | null;
  resting_heart_rate:    number | null;
  hrv:                   number | null;
  vo2_max:               number | null;
  active_minutes:        number | null;
  stand_hours:           number | null;
  exercise_minutes:      number | null;
  mindfulness_minutes:   number | null;
  sleep_hours:           number | null;
  sleep_quality:         string | null;
  deep_sleep_hours:      number | null;
  rem_sleep_hours:       number | null;
  sleep_efficiency:      number | null;
  time_in_bed_hours:     number | null;
  bedtime_iso:           string | null;
  wakeup_iso:            string | null;
  stress_score:          number | null;
  source:                HealthSource;
  recorded_at:           string;
  date?:                 string;
}

export interface SyncHealthInput {
  source:                 HealthSource;
  date?:                  string;
  distance_unit?:         string;
  active_calories?:       number;
  resting_calories?:      number;
  total_calories_burned?: number;
  steps?:                 number;
  distance?:              number;
  avg_heart_rate?:        number;
  max_heart_rate?:        number;
  resting_heart_rate?:    number;
  hrv?:                   number;
  vo2_max?:               number;
  active_minutes?:        number;
  mindfulness_minutes?:   number;
  sleep_hours?:           number;
  deep_sleep_hours?:      number;
  rem_sleep_hours?:       number;
  sleep_quality?:         string;
  sleep_efficiency?:      number;
  time_in_bed_hours?:     number;
  bedtime_iso?:           string;
  wakeup_iso?:            string;
  stand_hours?:           number;
  exercise_minutes?:      number;
}

export interface HealthContextValue {
  /** Today's health data, or null if not yet synced. */
  today: HealthData | null;

  /** True while any fetch is in-flight. */
  isLoading: boolean;

  /** True if the user granted HealthKit permission on this device. */
  isConnected: boolean;

  /** Syncs a health snapshot — hits POST /health/sync. */
  syncHealth: (input: SyncHealthInput) => Promise<HealthData>;

  /** Reads live data from HealthKit and syncs to the server (iOS only). */
  syncFromDevice: (force?: boolean) => Promise<void>;

  /** Re-fetches today's health data from the server. */
  refresh: () => Promise<void>;

  /** Fetches health for any date via shared resource cache. */
  fetchForDate: (date: string, force?: boolean) => Promise<HealthData | null>;
}

// ── API helper ─────────────────────────────────────────────────────────────

// Prefer the single EXPO_PUBLIC_API_KEY env var (same one apiFetch and avatar
// use). Fall back to the legacy EXPO_PUBLIC_API_SECRET_KEY so existing .env
// files keep working until they're migrated.
const API_KEY =
  process.env.EXPO_PUBLIC_API_KEY ??
  process.env.EXPO_PUBLIC_API_SECRET_KEY;

function healthFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  return apiFetch(path, {
    ...options,
    headers: {
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...(options.headers as Record<string, string>),
    },
  });
}

// ── Normalisation helpers ──────────────────────────────────────────────────

function num(v: unknown, fallback: number | null = null): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const parsed = Number(v.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Pulls the `today` reconciliation block out of a mutation response, if present.
 * Returns null when the backend does not (yet) include it — the legacy
 * `notifyTodayDataChanged` path remains the fallback.
 */
function extractTodayBundle(body: Record<string, unknown>): TodayReconcileBundle | null {
  const today = body.today;
  if (!today || typeof today !== 'object') return null;
  const t = today as Record<string, unknown>;
  if (typeof t.date !== 'string') return null;
  if (!t.summary || typeof t.summary !== 'object') return null;
  return today as TodayReconcileBundle;
}

/** Steps above this with zero distance usually means a failed HK read or stale server row. */
const STEPS_WITH_MISSING_DISTANCE = 100;

function hasStepsButNoDistance(steps: number, distance: number): boolean {
  return steps >= STEPS_WITH_MISSING_DISTANCE && distance <= 0;
}

/** Daily cumulative metrics from HealthKit should never regress after sync. */
function mergeCumulativeFromSyncInput(
  saved: HealthData,
  input: SyncHealthInput,
): HealthData {
  const maxNum = (a: number, b: number | undefined): number =>
    b !== undefined ? Math.max(a, b) : a;

  return {
    ...saved,
    steps:                 maxNum(saved.steps, input.steps),
    active_calories:       maxNum(saved.active_calories, input.active_calories),
    resting_calories:      maxNum(saved.resting_calories, input.resting_calories),
    total_calories_burned: maxNum(saved.total_calories_burned, input.total_calories_burned),
    distance:              maxNum(saved.distance, input.distance),
    active_minutes: input.active_minutes != null
      ? Math.max(saved.active_minutes ?? 0, input.active_minutes)
      : saved.active_minutes,
    exercise_minutes: input.exercise_minutes != null
      ? Math.max(saved.exercise_minutes ?? 0, input.exercise_minutes)
      : saved.exercise_minutes,
    stand_hours: input.stand_hours != null
      ? Math.max(saved.stand_hours ?? 0, input.stand_hours)
      : saved.stand_hours,
    mindfulness_minutes: input.mindfulness_minutes != null
      ? Math.max(saved.mindfulness_minutes ?? 0, input.mindfulness_minutes)
      : saved.mindfulness_minutes,
  };
}

/** Only sync if HealthKit returned at least one meaningful reading. */
function isEmptySummary(s: HealthKitSummary): boolean {
  return s.steps === 0
      && s.active_calories === 0
      && s.resting_calories === 0
      && s.distance === 0
      && s.resting_heart_rate === null
      && s.hrv === null
      && s.vo2_max === null
      && s.sleep_hours === 0
      && s.active_minutes === 0
      && s.stand_hours === 0
      && s.mindfulness_minutes === 0;
}

/** Merges fresh device data into a HealthData shape for optimistic UI updates. */
function applyKitSummary(current: HealthData | null, s: HealthKitSummary, date: string): HealthData {
  const keepPriorDistance =
    s.distance <= 0
    && current !== null
    && current.distance > 0
    && hasStepsButNoDistance(s.steps, s.distance);

  return {
    id:                    current?.id ?? '',
    active_calories:       s.active_calories,
    resting_calories:      s.resting_calories,
    total_calories_burned: s.total_calories_burned,
    steps:                 s.steps,
    distance:              keepPriorDistance ? current.distance : s.distance,
    distance_unit:         keepPriorDistance ? current.distance_unit : s.distance_unit,
    avg_heart_rate:        s.avg_heart_rate ?? current?.avg_heart_rate ?? null,
    max_heart_rate:        s.max_heart_rate ?? current?.max_heart_rate ?? null,
    resting_heart_rate:    s.resting_heart_rate,
    hrv:                   s.hrv,
    vo2_max:               s.vo2_max,
    active_minutes:        s.active_minutes,
    stand_hours:           s.stand_hours,
    exercise_minutes:      s.active_minutes,
    mindfulness_minutes:   s.mindfulness_minutes,
    sleep_hours:           s.sleep_hours,
    sleep_quality:         current?.sleep_quality ?? null,
    deep_sleep_hours:      s.deep_sleep_hours,
    rem_sleep_hours:       s.rem_sleep_hours,
    sleep_efficiency:      s.sleep_efficiency,
    time_in_bed_hours:     s.time_in_bed_hours,
    bedtime_iso:           s.bedtime_iso,
    wakeup_iso:            s.wakeup_iso,
    stress_score:          current?.stress_score ?? null,
    source:                'healthkit',
    recorded_at:           current?.recorded_at ?? new Date().toISOString(),
    date,
  };
}

/** Maps a HealthKit read into the POST /health/sync payload. */
function toSyncInput(s: HealthKitSummary): SyncHealthInput {
  const input: SyncHealthInput = {
    source:                'healthkit',
    date:                  getLocalDateString(),
    steps:                 s.steps,
    active_calories:       s.active_calories,
    resting_calories:      s.resting_calories,
    total_calories_burned: s.total_calories_burned,
    active_minutes:        s.active_minutes,
    exercise_minutes:      s.active_minutes,
    stand_hours:           s.stand_hours,
    mindfulness_minutes:   s.mindfulness_minutes,
    sleep_hours:           s.sleep_hours,
    deep_sleep_hours:      s.deep_sleep_hours,
    rem_sleep_hours:       s.rem_sleep_hours,
    time_in_bed_hours:     s.time_in_bed_hours,
  };
  // Omit distance when HK returned 0 but steps did not — avoids overwriting a good
  // server value for users whose distance read failed on an earlier sync.
  if (s.distance > 0) {
    input.distance = s.distance;
    input.distance_unit = s.distance_unit;
  } else if (!hasStepsButNoDistance(s.steps, s.distance)) {
    input.distance = s.distance;
    input.distance_unit = s.distance_unit;
  }
  if (s.resting_heart_rate !== null) input.resting_heart_rate = s.resting_heart_rate;
  if (s.hrv                !== null) input.hrv                = s.hrv;
  if (s.vo2_max            !== null) input.vo2_max            = s.vo2_max;
  if (s.sleep_efficiency   !== null) input.sleep_efficiency   = s.sleep_efficiency;
  if (s.avg_heart_rate     !== null) input.avg_heart_rate     = s.avg_heart_rate;
  if (s.max_heart_rate     !== null) input.max_heart_rate     = s.max_heart_rate;
  if (s.bedtime_iso        !== null) input.bedtime_iso        = s.bedtime_iso;
  if (s.wakeup_iso         !== null) input.wakeup_iso         = s.wakeup_iso;
  return input;
}

/**
 * Stable fingerprint of the metric fields we POST, so we only sync when the data
 * actually changed. Covers EVERY field in the payload (sleep, HRV, RHR, sleep
 * stages, vo2_max, …) — unlike the old movement-only comparison — and ignores
 * `source`/`date`. Numbers are rounded to absorb HealthKit float jitter that
 * would otherwise read as a change.
 */
function signHealthPayload(input: SyncHealthInput): string {
  const rest: Record<string, unknown> = { ...input };
  delete rest.source;
  delete rest.date;
  return Object.keys(rest)
    .sort()
    .map((k) => {
      const v = rest[k];
      return `${k}:${typeof v === 'number' ? Math.round(v * 1000) / 1000 : v}`;
    })
    .join('|');
}

/** Remember that the user is connected so the AsyncStorage fallback works. */
async function persistConnectedFlag(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('@roundfit/health_connected', 'true');
  } catch { /* storage unavailable */ }
}

function fromApiData(row: Record<string, unknown>): HealthData {
  return {
    id:                    String(row.id ?? ''),
    active_calories:       num(row.active_calories, 0) as number,
    resting_calories:      num(row.resting_calories, 0) as number,
    total_calories_burned: num(row.total_calories_burned, 0) as number,
    steps:                 num(row.steps, 0) as number,
    distance:              num(row.distance, 0) as number,
    distance_unit:         typeof row.distance_unit === 'string' ? row.distance_unit : 'km',
    avg_heart_rate:        num(row.avg_heart_rate),
    max_heart_rate:        num(row.max_heart_rate),
    resting_heart_rate:    num(row.resting_heart_rate),
    hrv:                   num(row.hrv),
    vo2_max:               num(row.vo2_max),
    active_minutes:        num(row.active_minutes),
    stand_hours:           num(row.stand_hours),
    exercise_minutes:      num(row.exercise_minutes),
    mindfulness_minutes:   num(row.mindfulness_minutes),
    sleep_hours:           num(row.sleep_hours),
    sleep_quality:         typeof row.sleep_quality === 'string' ? row.sleep_quality : null,
    deep_sleep_hours:      num(row.deep_sleep_hours),
    rem_sleep_hours:       num(row.rem_sleep_hours),
    sleep_efficiency:      num(row.sleep_efficiency),
    time_in_bed_hours:     num(row.time_in_bed_hours),
    bedtime_iso:           typeof row.bedtime_iso === 'string' ? row.bedtime_iso : null,
    wakeup_iso:            typeof row.wakeup_iso  === 'string' ? row.wakeup_iso  : null,
    stress_score:          num(row.stress_score),
    source:                (row.source as HealthSource) ?? 'healthkit',
    recorded_at:           typeof row.recorded_at === 'string' ? row.recorded_at : new Date().toISOString(),
    date:                  typeof row.date === 'string' ? row.date : undefined,
  };
}

function isHealthDataForDate(data: HealthData, targetDate: string): boolean {
  if (data.date) return data.date === targetDate;
  if (data.wakeup_iso) {
    const wakeDate = getLocalDateString(new Date(data.wakeup_iso));
    if (wakeDate === targetDate) return true;
  }
  const recordedDate = new Date(data.recorded_at);
  if (Number.isNaN(recordedDate.getTime())) return false;
  return getLocalDateString(recordedDate) === targetDate;
}

function formatDate(date: Date): string {
  return getLocalDateString(date);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Context ────────────────────────────────────────────────────────────────

const HealthContext = createContext<HealthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [today,       setToday]       = useState<HealthData | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const hasFetchedRef = useRef(false);
  const todayRef      = useRef<HealthData | null>(null);
  useEffect(() => { todayRef.current = today; }, [today]);

  // ── Fetch today ──────────────────────────────────────────────────────────
  const fetchByDate = useCallback(async (
    targetDate: string,
    force = false,
  ): Promise<HealthData | null> => {
    if (!user?.id) return null;

    const key = buildResourceKey('health', user.id, targetDate);
    return fetchWithResourceCache<HealthData | null>(
      key,
      ttlForDate(targetDate),
      async () => {
        const { ok, body } = await healthFetch(`/health/today?date=${targetDate}`);
        if (ok && body.health_data) {
          const parsed = fromApiData(body.health_data as Record<string, unknown>);
          if (isHealthDataForDate(parsed, targetDate)) return parsed;
        }
        return null;
      },
      { force, allowStale: !force },
    );
  }, [user?.id]);

  const fetchToday = useCallback(async (force = false): Promise<boolean> => {
    const calendarToday = getLocalDateString();
    const sleepDay = localSleepDateString();
    let parsed = await fetchByDate(calendarToday, force);
    if (sleepDay !== calendarToday) {
      const priorSleep = await fetchByDate(sleepDay, force);
      parsed = mergePriorDaySleepIntoHealth(parsed, priorSleep);
    }
    setToday(parsed);
    return parsed !== null;
  }, [fetchByDate]);

  // ── Sync health ──────────────────────────────────────────────────────────
  const saveHealthSnapshot = useCallback(async (
    input: SyncHealthInput,
    applyTodayState: boolean,
    notify = true,
  ): Promise<HealthData> => {
    const { ok, body } = await healthFetch('/health/sync', {
      method: 'POST',
      body:   JSON.stringify(input),
    });
    if (!ok || !body.health_data) throw new Error('Failed to sync health data');
    const saved = fromApiData(body.health_data as Record<string, unknown>);
    let merged = mergeCumulativeFromSyncInput(saved, input);
    if (
      typeof input.distance === 'number'
      && input.distance > 0
      && hasStepsButNoDistance(merged.steps, merged.distance)
    ) {
      merged = {
        ...merged,
        distance:      input.distance,
        distance_unit: input.distance_unit ?? merged.distance_unit,
      };
    }
    if (applyTodayState) {
      setToday(merged);
      if (user?.id) {
        const date = saved.date ?? getLocalDateString();
        void setResourceCached(
          buildResourceKey('health', user.id, date),
          merged,
          ttlForDate(date),
        );
        if (notify) {
          const bundle = extractTodayBundle(body);
          if (bundle) applyTodayReconcile(bundle);
          void notifyTodayDataChanged(user.id, 'health');
        }
      }
    }
    return merged;
  }, [user?.id]);

  const syncHealth = useCallback(async (input: SyncHealthInput): Promise<HealthData> => {
    return saveHealthSnapshot(input, true);
  }, [saveHealthSnapshot]);

  // ── Read from HealthKit and push to backend ───────────────────────────────
  const syncFromDevice = useCallback(async (force = false) => {
    const hk = getHealthKitModule();
    if (!hk) return;

    try {
      // Ensure the access token is fresh before making any API calls.
      // syncFromDevice fires on startup and foreground-resume — the stored
      // token may have expired while the app was in the background.
      const sessionValid = await proactiveRefreshIfNeeded();
      if (!sessionValid) return;

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const lastSyncRaw = await AsyncStorage.getItem(LAST_HEALTH_SYNC_KEY);
      const now = Date.now();
      const msSinceLastSync = lastSyncRaw
        ? now - parseInt(lastSyncRaw, 10)
        : Number.POSITIVE_INFINITY;
      const backfillThrottled = !force && msSinceLastSync < HEALTH_BACKFILL_THROTTLE_MS;

      const authorized = await ensureHealthKitAuthorized(hk);
      if (!authorized) return;

      const todayDate = getLocalDateString();

      if (!backfillThrottled) {
        const createdAtDate = user?.createdAt ? new Date(user.createdAt) : null;
        const hasValidCreatedAt = createdAtDate !== null && !Number.isNaN(createdAtDate.getTime());
        const accountStartDate = hasValidCreatedAt
          ? formatDate(startOfDay(createdAtDate))
          : formatDate(addDays(startOfDay(new Date()), -1));
        const cursorRaw = await AsyncStorage.getItem(HEALTH_BACKFILL_CURSOR_KEY);
        const cursorDate = cursorRaw && /^\d{4}-\d{2}-\d{2}$/.test(cursorRaw) ? cursorRaw : null;
        const backfillStartDate = cursorDate
          ? formatDate(addDays(startOfDay(new Date(`${cursorDate}T00:00:00`)), 1))
          : accountStartDate;

        let backfillCursor = backfillStartDate;
        while (backfillCursor < todayDate) {
          const dayData = await fetchByDate(backfillCursor);
          const needsDistanceBackfill =
            !dayData || hasStepsButNoDistance(dayData.steps, dayData.distance);
          if (needsDistanceBackfill) {
            const daySummary = await readHealthKitForDate(hk, backfillCursor);
            if (!isEmptySummary(daySummary) && daySummary.distance > 0) {
              const payload = toSyncInput(daySummary);
              payload.date = backfillCursor;
              await saveHealthSnapshot(payload, false);
            }
          }
          await AsyncStorage.setItem(HEALTH_BACKFILL_CURSOR_KEY, backfillCursor);
          backfillCursor = formatDate(addDays(startOfDay(new Date(`${backfillCursor}T00:00:00`)), 1));
        }
        // Mark backfill complete through today (only after the loop actually ran).
        await AsyncStorage.setItem(HEALTH_BACKFILL_CURSOR_KEY, todayDate);
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const summary = await readDailyHealthKit(hk, todayStart, new Date());
      if (isEmptySummary(summary)) return;

      const payload = toSyncInput(summary);
      const prior = todayRef.current;
      const applied = applyKitSummary(prior, summary, todayDate);

      // Paint fresh HealthKit data immediately — do not wait on cache or API.
      setToday(applied);

      // Only POST when the payload differs from what we last synced for this day.
      // The signature covers every posted field (sleep/HRV/RHR included), and a new
      // day has no stored signature so the first sync of the day always posts — a
      // built-in once-a-day floor. The backend upsert is idempotent, so skipping an
      // identical post is risk-free.
      const sig = signHealthPayload(payload);
      const storedSig = await AsyncStorage.getItem(healthSigStorageKey(todayDate));
      const changed = sig !== storedSig;
      const shouldPost = force || changed;

      if (shouldPost) {
        // Broadcast a 'health' mutation only when data changed (or forced), so an
        // unchanged sync never fans out a force-refetch across other contexts.
        await saveHealthSnapshot(payload, true, changed || force);
        await AsyncStorage.setItem(healthSigStorageKey(todayDate), sig);
      } else if (user?.id) {
        void setResourceCached(
          buildResourceKey('health', user.id, todayDate),
          applied,
          ttlForDate(todayDate),
        );
      }

      // Advance the sync-throttle timestamp every run (independent of whether we
      // posted today's data) so reduced posting can't make the expensive past-day
      // backfill loop run on every sync.
      await AsyncStorage.setItem(LAST_HEALTH_SYNC_KEY, now.toString());

      await persistConnectedFlag();
      setIsConnected(true);
    } catch {
      // HealthKit not available in Expo Go or simulator without data
    }
  }, [fetchByDate, saveHealthSnapshot, user?.createdAt, user?.id]);

  // ── Mount: fetch once per authenticated session ───────────────────────────
  useEffect(() => {
    if (status === 'loading') return;

    if (!hasActiveUserSession(status, user)) {
      setToday(null);
      setIsLoading(false);
      hasFetchedRef.current = false;
      return;
    }

    // Only run once per login session — navigating between screens must not re-trigger.
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    let cancelled = false;

    (async () => {
      const today = getLocalDateString();
      if (user?.id) {
        const cached = await getResourceCached<HealthData>(
          buildResourceKey('health', user.id, today),
        );
        if (cached && !cancelled) {
          setToday(cached.data);
          setIsLoading(false);
        } else if (!cancelled) {
          setIsLoading(true);
        }
      }

      try {
        await fetchToday(false);
        if (!cancelled) await syncFromDevice(false);
        // Some accounts have steps on the server but distance stuck at 0 from an
        // earlier failed HK read — force one repair sync when that pattern appears.
        if (!cancelled && todayRef.current && hasStepsButNoDistance(
          todayRef.current.steps,
          todayRef.current.distance,
        )) {
          await syncFromDevice(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // Depend only on session identity — not the whole `user` object or the
    // fetch callbacks. A background /auth/me profile refresh changes those
    // identities mid-flight, which would cancel this once-per-session load
    // before its `finally` clears isLoading, then bail on `hasFetchedRef` —
    // leaving isLoading stuck true (recovery skeleton never clears).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id]);

  // ── Reconcile health from a recovery/sleep log ────────────────────────────
  // A manual sleep log writes sleep into health_data on the backend and returns
  // the updated row; the recovery context emits it here so health's `today` +
  // cache reflect the new sleep without a separate /health/sync POST.
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    return registerHealthReconcileListener(({ date, row }) => {
      const parsed = fromApiData(row);
      if (date === getLocalDateString()) setToday(parsed);
      void setResourceCached(
        buildResourceKey('health', uid, date),
        parsed,
        ttlForDate(date),
      );
    });
  }, [user?.id]);

  // ── Check HealthKit connection status ────────────────────────────────────
  // Re-runs on user change so switching accounts resets the flag correctly.
  useEffect(() => {
    if (Platform.OS !== 'ios') { setIsConnected(false); return; }
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setIsConnected(false);
      return;
    }

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const val = await AsyncStorage.getItem('@roundfit/health_connected');
        setIsConnected(val === 'true');
      } catch { /* storage unavailable */ }
    })();
  }, [status, user?.id]);

  // ── Re-sync whenever the app returns to foreground ───────────────────────
  useEffect(() => {
    if (Platform.OS !== 'ios' || status !== 'authenticated') return;
    const handleAppState = async (nextState: AppStateStatus) => {
      if (nextState !== 'active' || !user?.id) return;
      void fetchToday(false);
      void syncFromDevice(false);
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [status, user?.id, fetchToday, syncFromDevice]);

  // ── Poll today's HealthKit metrics while foregrounded ────────────────────
  useEffect(() => {
    if (Platform.OS !== 'ios' || status !== 'authenticated') return;

    const interval = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void syncFromDevice(false);
    }, HEALTH_TODAY_POLL_MS);

    return () => clearInterval(interval);
  }, [status, syncFromDevice]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await fetchToday(true);
    await syncFromDevice(true);
  }, [fetchToday, syncFromDevice]);

  const fetchForDate = useCallback(
    (date: string, force = false) => fetchByDate(date, force),
    [fetchByDate],
  );

  return (
    <HealthContext.Provider value={{
      today, isLoading, isConnected, syncHealth, syncFromDevice, refresh, fetchForDate,
    }}>
      {children}
    </HealthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useHealth(): HealthContextValue {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used inside <HealthProvider>');
  return ctx;
}
