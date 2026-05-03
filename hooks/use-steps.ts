import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

import { isExpoGoEnvironment } from '@/utils/healthkit';

export interface DaySteps {
  /** Short label: "Mon", "Tue", … */
  label: string;
  /** ISO date string for the day (midnight local time) */
  date: string;
  steps: number;
  /** true if this day is today */
  isToday: boolean;
}

export interface StepsData {
  days: DaySteps[];
  /** Today's step count */
  todaySteps: number;
  /** Sum across the whole week */
  weekTotal: number;
  isLoading: boolean;
  /** Whether Health data is available and connected */
  isConnected: boolean;
  /** Re-run the query */
  refetch: () => void;
}

const HEALTH_KEY = '@roundfit/health_connected';
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STEP_ID = 'HKQuantityTypeIdentifierStepCount';

type Dict = Record<string, unknown>;
type AsyncFn = (...args: unknown[]) => Promise<unknown>;

/** Returns midnight (local) for the given date */
function startOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Returns 23:59:59.999 (local) for the given date */
function endOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Returns the current week: Monday … Sunday. */
function getWeekDays(): Date[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asDict(v: unknown): Dict | null {
  return v !== null && typeof v === 'object' ? (v as Dict) : null;
}

function getAsyncFn(obj: Dict, name: string): AsyncFn | null {
  const candidate = obj[name];
  return typeof candidate === 'function' ? (candidate as AsyncFn) : null;
}

/**
 * HealthKit library versions return slightly different sample/stat shapes.
 * This parser intentionally checks multiple keys to avoid silently returning 0.
 */
function extractStepValue(result: unknown): number {
  if (Array.isArray(result)) {
    const sum = result.reduce((acc, item) => {
      const row = asDict(item);
      if (!row) return acc;

      const direct =
        asNumber(row.quantity) ??
        asNumber(row.value) ??
        asNumber(row.count) ??
        asNumber(row.qty);

      if (direct !== null) return acc + direct;

      const nested = asDict(row.quantity);
      const nestedNum =
        (nested && (asNumber(nested.count) ?? asNumber(nested.value) ?? asNumber(nested.quantity))) ?? null;

      return acc + (nestedNum ?? 0);
    }, 0);
    return Math.max(0, Math.round(sum));
  }

  const obj = asDict(result);
  if (!obj) return 0;

  const value =
    asNumber(obj.sumQuantity) ??
    asNumber(obj.cumulativeSum) ??
    asNumber(obj.value) ??
    asNumber(obj.quantity) ??
    asNumber(obj.count) ??
    asNumber(obj.sum);

  return Math.max(0, Math.round(value ?? 0));
}

/** Log raw HealthKit payloads (dev only). Truncate huge arrays. */
function logHealthKitRaw(
  source: 'queryQuantitySamples' | 'queryStatisticsForQuantity',
  day: Date,
  request: unknown,
  raw: unknown,
  err?: unknown,
): void {
  if (!__DEV__) return;
  const dateStr = day.toISOString().split('T')[0];
  if (err !== undefined) {
    console.log('[RoundFit HealthKit RAW] error', {
      source,
      date: dateStr,
      request,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  let payload: unknown = raw;
  if (Array.isArray(raw) && raw.length > 20) {
    payload = {
      length: raw.length,
      first20: raw.slice(0, 20),
    };
  }
  console.log('[RoundFit HealthKit RAW]', {
    source,
    date: dateStr,
    request,
    raw: payload,
  });
}

async function queryStepsWithFallback(HK: Dict, day: Date): Promise<number> {
  const from = startOf(day);
  const to = endOf(day);

  // queryStatisticsForQuantity deduplicates overlapping sources (iPhone + Watch + apps)
  // and matches what the Health app displays. Try this first.
  const queryStatisticsForQuantity = getAsyncFn(HK, 'queryStatisticsForQuantity');
  if (queryStatisticsForQuantity) {
    const statistics = ['cumulativeSum'] as const;
    const optionVariants: Dict[] = [
      { unit: 'count', filter: { date: { startDate: from, endDate: to } } },
      { unit: 'count()', filter: { date: { startDate: from, endDate: to } } },
      { unit: 'count', startDate: from, endDate: to },
      { unit: 'count()', startDate: from, endDate: to },
    ];

    for (const options of optionVariants) {
      try {
        const res = await queryStatisticsForQuantity(STEP_ID, statistics, options);
        logHealthKitRaw('queryStatisticsForQuantity', day, { statistics, options }, res);
        const steps = extractStepValue(res);
        if (steps > 0) return steps;
      } catch (e) {
        logHealthKitRaw('queryStatisticsForQuantity', day, { statistics, options }, undefined, e);
      }
    }
  }

  // Fallback: sum raw samples. May over-count if multiple sources recorded the same steps.
  const queryQuantitySamples = getAsyncFn(HK, 'queryQuantitySamples');
  if (queryQuantitySamples) {
    const optionVariants: Dict[] = [
      {
        unit: 'count',
        ascending: true,
        limit: 0,
        filter: { date: { startDate: from, endDate: to } },
      },
      {
        unit: 'count()',
        ascending: true,
        limit: 0,
        filter: { date: { startDate: from, endDate: to } },
      },
      { from, to, unit: 'count', ascending: true },
      { startDate: from, endDate: to, unit: 'count', ascending: true },
    ];

    for (const options of optionVariants) {
      try {
        const res = await queryQuantitySamples(STEP_ID, options);
        logHealthKitRaw('queryQuantitySamples', day, { options }, res);
        const steps = extractStepValue(res);
        if (steps > 0) return steps;
      } catch (e) {
        logHealthKitRaw('queryQuantitySamples', day, { options }, undefined, e);
      }
    }
  }

  return 0;
}

export function useSteps(): StepsData {
  const [days, setDays] = useState<DaySteps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (isExpoGoEnvironment()) return;

    let cancelled = false;

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default as {
          getItem: (k: string) => Promise<string | null>;
        };
        const val = await AsyncStorage.getItem(HEALTH_KEY);
        if (val !== 'true') return;
      } catch {
        return;
      }

      let HK: Dict;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        HK = require('@kingstinct/react-native-healthkit') as Dict;
        const isHealthDataAvailable = getAsyncFn(HK, 'isHealthDataAvailable');
        if (!isHealthDataAvailable) return;
        const available = await isHealthDataAvailable();
        if (available !== true || cancelled) return;
      } catch {
        return;
      }

      setIsConnected(true);
      setIsLoading(true);

      try {
        const weekDays = getWeekDays();
        const today = startOf(new Date()).getTime();

        const results = await Promise.all(
          weekDays.map(async (d): Promise<DaySteps> => {
            const isFuture = startOf(d).getTime() > today;
            const steps = isFuture ? 0 : await queryStepsWithFallback(HK, d);
            return {
              label: DAY_LABELS[d.getDay()],
              date: d.toISOString().split('T')[0],
              steps,
              isToday: startOf(d).getTime() === today,
            };
          }),
        );

        if (__DEV__ && !cancelled) {
          const todayCount = results.find((r) => r.isToday)?.steps ?? 0;
          const weekSum = results.reduce((sum, d) => sum + d.steps, 0);
          console.log('[RoundFit Steps]', {
            todaySteps: todayCount,
            weekTotal: weekSum,
            byDay: results.map((d) => ({ date: d.date, label: d.label, steps: d.steps, isToday: d.isToday })),
          });
        }

        if (!cancelled) setDays(results);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const todaySteps = days.find((d) => d.isToday)?.steps ?? 0;
  const weekTotal = days.reduce((s, d) => s + d.steps, 0);

  return { days, todaySteps, weekTotal, isLoading, isConnected, refetch };
}
