import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { useAuth } from '@/context/auth-context';
import {
  ensureHealthKitAuthorized,
  getHealthKitModule,
  readDailyHealthKit,
  type HealthKitSummary,
} from '@/utils/healthkit';

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE   = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';
const TIMEOUT_MS = 10_000;

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
  weight_kg:             number | null;
  source:                HealthSource;
  recorded_at:           string;
}

export interface SyncHealthInput {
  source:                 HealthSource;
  active_calories?:       number;
  resting_calories?:      number;
  total_calories_burned?: number;
  steps?:                 number;
  distance?:              number;
  unit?:                  'metric' | 'imperial';
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

async function healthFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const run = (signal: AbortSignal) =>
    fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include', signal });

  try {
    const res = await run(controller.signal);

    if (res.status === 401) {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST', credentials: 'include', signal: controller.signal,
      });
      if (refreshRes.ok) {
        const retryRes  = await run(controller.signal);
        const retryBody = await retryRes.json().catch(() => ({}));
        return { ok: retryRes.ok, status: retryRes.status, body: retryBody };
      }
    }

    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
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
      && s.distance_km === 0
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
    unit:                  'metric',
    steps:                 s.steps,
    active_calories:       s.active_calories,
    resting_calories:      s.resting_calories,
    total_calories_burned: s.total_calories_burned,
    distance:              s.distance_km,
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
    weight_kg:             num(row.weight_kg),
    source:                (row.source as HealthSource) ?? 'healthkit',
    recorded_at:           typeof row.recorded_at === 'string' ? row.recorded_at : new Date().toISOString(),
  };
}

// ── Context ────────────────────────────────────────────────────────────────

const HealthContext = createContext<HealthContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  const [today,       setToday]       = useState<HealthData | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  // ── Fetch today ──────────────────────────────────────────────────────────
  const fetchToday = useCallback(async () => {
    const { ok, status, body } = await healthFetch('/health/today');
    console.log('[HealthKit] GET /health/today →', status, JSON.stringify(body));

    if (ok && body.data) {
      // data may be a single object or an array (backend may return multiple rows)
      const row = Array.isArray(body.data) ? body.data[0] : body.data;
      if (row) setToday(fromApiData(row as Record<string, unknown>));
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setToday(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setToday(null);

    (async () => {
      try {
        await fetchToday();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [status, user?.id, fetchToday]);

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

  // ── Sync health ──────────────────────────────────────────────────────────
  const syncHealth = useCallback(async (input: SyncHealthInput): Promise<HealthData> => {
    const { ok, body } = await healthFetch('/health/sync', {
      method: 'POST',
      body:   JSON.stringify(input),
    });
    if (!ok || !body.data) throw new Error('Failed to sync health data');
    const saved = fromApiData(body.data as Record<string, unknown>);
    setToday(saved);
    return saved;
  }, []);

  // ── Read from HealthKit and push to backend ───────────────────────────────
  const syncFromDevice = useCallback(async () => {
    const hk = getHealthKitModule();
    if (!hk) return;

    try {
      const authorized = await ensureHealthKitAuthorized(hk);
      if (!authorized) return;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const summary = await readDailyHealthKit(hk, startOfDay, new Date());

      if (isEmptySummary(summary)) {
        console.log('[HealthKit] all zeros — skipping sync to preserve backend data', summary);
        return;
      }

      const payload = toSyncInput(summary);
      console.log('[HealthKit] POST /health/sync payload:', JSON.stringify(payload, null, 2));

      await syncHealth(payload);
      await persistConnectedFlag();
      setIsConnected(true);
    } catch {
      // HealthKit not available in Expo Go or simulator without data
    }
  }, [syncHealth]);

  // ── Auto-sync on mount and on foreground ─────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;
    void syncFromDevice();
  }, [status, syncFromDevice]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active' && status === 'authenticated') {
        void syncFromDevice();
      }
    });
    return () => sub.remove();
  }, [status, syncFromDevice]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([fetchToday(), syncFromDevice()]);
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
