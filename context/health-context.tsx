import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/utils/api';
import {
  ensureHealthKitAuthorized,
  getHealthKitModule,
  readHealthKitForDate,
  readDailyHealthKit,
  type HealthKitSummary,
} from '@/utils/healthkit';
import { getLocalDateString } from '@/utils/date';

// ── Config ─────────────────────────────────────────────────────────────────

const HEALTH_BACKFILL_CURSOR_KEY = '@roundfit/health_backfill_cursor';

// ── Types ──────────────────────────────────────────────────────────────────

export type HealthSource = 'healthkit' | 'googlefit';

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
  mindfulness_minutes:   number | null;
  sleep_hours:           number | null;
  deep_sleep_hours:      number | null;
  rem_sleep_hours:       number | null;
  sleep_efficiency:      number | null;
  time_in_bed_hours:     number | null;
  bedtime_iso:           string | null;
  wakeup_iso:            string | null;
  weight_kg:             number | null;
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
  sleep_efficiency?:      number;
  time_in_bed_hours?:     number;
  bedtime_iso?:           string;
  wakeup_iso?:            string;
  weight_kg?:             number;
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
  syncFromDevice: () => Promise<void>;

  /** Re-fetches today's health data from the server. */
  refresh: () => Promise<void>;
}

// ── API helper ─────────────────────────────────────────────────────────────

const API_KEY = process.env.EXPO_PUBLIC_API_SECRET_KEY;

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
  return typeof v === 'number' ? v : fallback;
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
      && s.mindfulness_minutes === 0
      && s.weight_kg === null;
}

/** Maps a HealthKit read into the POST /health/sync payload. */
function toSyncInput(s: HealthKitSummary): SyncHealthInput {
  const input: SyncHealthInput = {
    source:                'healthkit',
    date:                  getLocalDateString(),
    distance_unit:         s.distance_unit,
    steps:                 s.steps,
    active_calories:       s.active_calories,
    resting_calories:      s.resting_calories,
    total_calories_burned: s.total_calories_burned,
    distance:              s.distance,
    active_minutes:        s.active_minutes,
    mindfulness_minutes:   s.mindfulness_minutes,
    sleep_hours:           s.sleep_hours,
    deep_sleep_hours:      s.deep_sleep_hours,
    rem_sleep_hours:       s.rem_sleep_hours,
    time_in_bed_hours:     s.time_in_bed_hours,
  };
  if (s.resting_heart_rate !== null) input.resting_heart_rate = s.resting_heart_rate;
  if (s.hrv                !== null) input.hrv                = s.hrv;
  if (s.vo2_max            !== null) input.vo2_max            = s.vo2_max;
  if (s.sleep_efficiency   !== null) input.sleep_efficiency   = s.sleep_efficiency;
  if (s.weight_kg          !== null) input.weight_kg          = s.weight_kg;
  if (s.bedtime_iso        !== null) input.bedtime_iso        = s.bedtime_iso;
  if (s.wakeup_iso         !== null) input.wakeup_iso         = s.wakeup_iso;
  return input;
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
    mindfulness_minutes:   num(row.mindfulness_minutes),
    sleep_hours:           num(row.sleep_hours),
    deep_sleep_hours:      num(row.deep_sleep_hours),
    rem_sleep_hours:       num(row.rem_sleep_hours),
    sleep_efficiency:      num(row.sleep_efficiency),
    time_in_bed_hours:     num(row.time_in_bed_hours),
    bedtime_iso:           typeof row.bedtime_iso === 'string' ? row.bedtime_iso : null,
    wakeup_iso:            typeof row.wakeup_iso  === 'string' ? row.wakeup_iso  : null,
    weight_kg:             num(row.weight_kg),
    source:                (row.source as HealthSource) ?? 'healthkit',
    recorded_at:           typeof row.recorded_at === 'string' ? row.recorded_at : new Date().toISOString(),
    date:                  typeof row.date === 'string' ? row.date : undefined,
  };
}

function isHealthDataForDate(data: HealthData, targetDate: string): boolean {
  if (data.date) return data.date === targetDate;
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
  const hasFetchedRef    = useRef(false);

  // ── Fetch today ──────────────────────────────────────────────────────────
  const fetchByDate = useCallback(async (targetDate: string): Promise<HealthData | null> => {
    const { ok, body } = await healthFetch(`/health/today?date=${targetDate}`);
    if (ok && body.health_data) {
      const parsed = fromApiData(body.health_data as Record<string, unknown>);
      if (isHealthDataForDate(parsed, targetDate)) {
        return parsed;
      }
      return null;
    }
    return null;
  }, []);

  const fetchToday = useCallback(async (): Promise<boolean> => {
    const parsed = await fetchByDate(getLocalDateString());
    setToday(parsed);
    return parsed !== null;
  }, [fetchByDate]);

  // ── Sync health ──────────────────────────────────────────────────────────
  const saveHealthSnapshot = useCallback(async (
    input: SyncHealthInput,
    applyTodayState: boolean,
  ): Promise<HealthData> => {
    const { ok, body } = await healthFetch('/health/sync', {
      method: 'POST',
      body:   JSON.stringify(input),
    });
    if (!ok || !body.health_data) throw new Error('Failed to sync health data');
    const saved = fromApiData(body.health_data as Record<string, unknown>);
    if (applyTodayState) setToday(saved);
    return saved;
  }, []);

  const syncHealth = useCallback(async (input: SyncHealthInput): Promise<HealthData> => {
    return saveHealthSnapshot(input, true);
  }, [saveHealthSnapshot]);

  // ── Read from HealthKit and push to backend ───────────────────────────────
  const syncFromDevice = useCallback(async (force = false) => {
    const hk = getHealthKitModule();
    if (!hk) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const lastSync     = await AsyncStorage.getItem('@roundfit/last_health_sync');
      const now          = Date.now();

      if (!force && lastSync) {
        const minutesSince = (now - parseInt(lastSync)) / 60000;
        if (minutesSince < 30) {
          console.log('[HealthKit] skipping sync — last sync was', Math.round(minutesSince), 'mins ago');
          return;
        }
      }

      const authorized = await ensureHealthKitAuthorized(hk);
      if (!authorized) return;

      const todayDate = getLocalDateString();
      const createdAtDate = user?.createdAt ? new Date(user.createdAt) : null;
      const hasValidCreatedAt = createdAtDate !== null && !Number.isNaN(createdAtDate.getTime());
      const accountStartDate = hasValidCreatedAt
        ? formatDate(startOfDay(createdAtDate))
        : formatDate(addDays(startOfDay(new Date()), -1));
      const cursorRaw = await AsyncStorage.getItem(HEALTH_BACKFILL_CURSOR_KEY);
      const cursorDate = cursorRaw && /^\d{4}-\d{2}-\d{2}$/.test(cursorRaw) ? cursorRaw : null;
      const backfillStartDate = (!force && cursorDate)
        ? formatDate(addDays(startOfDay(new Date(`${cursorDate}T00:00:00`)), 1))
        : accountStartDate;

      let backfillCursor = backfillStartDate;
      while (backfillCursor < todayDate) {
        const dayData = await fetchByDate(backfillCursor);
        if (!dayData) {
          const daySummary = await readHealthKitForDate(hk, backfillCursor);
          if (!isEmptySummary(daySummary)) {
            const payload = toSyncInput(daySummary);
            payload.date = backfillCursor;
            console.log('[HealthKit] backfill /health/sync payload:', JSON.stringify(payload, null, 2));
            await saveHealthSnapshot(payload, false);
          }
        }
        await AsyncStorage.setItem(HEALTH_BACKFILL_CURSOR_KEY, backfillCursor);
        backfillCursor = formatDate(addDays(startOfDay(new Date(`${backfillCursor}T00:00:00`)), 1));
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const summary = await readDailyHealthKit(hk, todayStart, new Date());

      if (isEmptySummary(summary)) {
        console.log('[HealthKit] all zeros — skipping sync to preserve backend data', summary);
        return;
      }

      const payload = toSyncInput(summary);
      console.log('[HealthKit] POST /health/sync payload:', JSON.stringify(payload, null, 2));

      await saveHealthSnapshot(payload, true);
      await persistConnectedFlag();
      await AsyncStorage.setItem('@roundfit/last_health_sync', now.toString());
      await AsyncStorage.setItem(HEALTH_BACKFILL_CURSOR_KEY, todayDate);
      setIsConnected(true);
    } catch {
      // HealthKit not available in Expo Go or simulator without data
    }
  }, [fetchByDate, saveHealthSnapshot, user?.createdAt]);

  // ── Mount: fetch once per authenticated session ───────────────────────────
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setToday(null);
      setIsLoading(false);
      hasFetchedRef.current = false;
      return;
    }

    // Only run once per login session — navigating between screens must not re-trigger.
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    let cancelled = false;
    setIsLoading(true);
    setToday(null);

    (async () => {
      try {
        const hasData = await fetchToday();
        if (!cancelled) await syncFromDevice(!hasData);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchToday, syncFromDevice]);

  // ── Check HealthKit connection status ────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const val = await AsyncStorage.getItem('@roundfit/health_connected');
        setIsConnected(val === 'true');
      } catch { /* storage unavailable */ }
    })();
  }, []);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const hasData = await fetchToday();
    await syncFromDevice(!hasData);
  }, [fetchToday, syncFromDevice]);

  return (
    <HealthContext.Provider value={{ today, isLoading, isConnected, syncHealth, syncFromDevice, refresh }}>
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
