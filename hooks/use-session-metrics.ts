import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getCatalogEntryById } from '@/config/workout-catalog';
import type { HealthData } from '@/context/health-context';
import { useAuth } from '@/context/auth-context';
import { useWorkoutSession } from '@/context/workout-session-context';
import { useHealth } from '@/hooks/use-health';
import type { WorkoutSession } from '@/types/workout-session';
import {
  getActiveHealthKitWorkout,
  metricsFromHealthKitWorkout,
} from '@/utils/healthkit';
import {
  DEFAULT_SESSION_MET,
  DEFAULT_SESSION_WEIGHT_KG,
  resolveSessionMetrics,
  sessionElapsedMinutes,
  type ResolveSessionMetricsInput,
  type SessionMetrics,
  type SessionMetricsSource,
} from '@/utils/session-metrics';

const POLL_INTERVAL_MS = 3_000;

export type { SessionMetrics, SessionMetricsSource };

export interface UseSessionMetricsResult {
  metrics: SessionMetrics | null;
  isPolling: boolean;
  refresh: () => Promise<SessionMetrics | null>;
  /** Flattened fields for Live Activity adapters (Agent 2). */
  caloriesBurned: number;
  heartRate?: number;
  source: SessionMetricsSource | null;
}

function fallbackHeartRateFromHealth(
  health: Pick<HealthData, 'avg_heart_rate' | 'max_heart_rate'> | null | undefined,
): ResolveSessionMetricsInput['fallbackHeartRate'] {
  if (health?.avg_heart_rate == null || health.avg_heart_rate <= 0) return undefined;
  return {
    avgHeartRate: Math.round(health.avg_heart_rate),
    ...(health.max_heart_rate != null && health.max_heart_rate > 0
      ? { maxHeartRate: Math.round(health.max_heart_rate) }
      : {}),
  };
}

/** Sync delta / MET resolution — used when ending a session without async HK fetch. */
export function resolveSessionMetricsDelta(
  session: WorkoutSession,
  healthToday: Pick<HealthData, 'active_calories' | 'avg_heart_rate' | 'max_heart_rate'> | null | undefined,
  weightKg: number = DEFAULT_SESSION_WEIGHT_KG,
): SessionMetrics {
  const catalogEntry = getCatalogEntryById(session.workoutType);
  const met = catalogEntry?.met ?? DEFAULT_SESSION_MET;
  const currentActiveCalories =
    healthToday?.active_calories ?? session.baselineActiveCalories;

  return resolveSessionMetrics({
    elapsedMinutes: sessionElapsedMinutes(session.startedAt),
    baselineActiveCalories: session.baselineActiveCalories,
    currentActiveCalories,
    weightKg,
    met,
    healthKitMetrics: null,
    fallbackHeartRate: fallbackHeartRateFromHealth(healthToday),
  });
}

export function useSessionMetrics(): UseSessionMetricsResult {
  const { status, session } = useWorkoutSession();
  const { today: healthToday } = useHealth();
  const { user } = useAuth();

  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const healthRef = useRef(healthToday);
  healthRef.current = healthToday;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const shouldPoll =
    status === 'active' && session != null && session.pausedAt == null;

  const refresh = useCallback(async (): Promise<SessionMetrics | null> => {
    const currentSession = sessionRef.current;
    if (!currentSession) return null;

    const catalogEntry = getCatalogEntryById(currentSession.workoutType);
    const met = catalogEntry?.met ?? DEFAULT_SESSION_MET;
    const weightKg =
      user?.weightKg != null && user.weightKg > 0
        ? user.weightKg
        : DEFAULT_SESSION_WEIGHT_KG;

    const health = healthRef.current;
    const currentActiveCalories =
      health?.active_calories ?? currentSession.baselineActiveCalories;

    let healthKitMetrics = null;
    try {
      const workout = await getActiveHealthKitWorkout(
        new Date(currentSession.startedAt),
        currentSession.healthkitUuid,
      );
      if (workout) {
        healthKitMetrics = metricsFromHealthKitWorkout(workout);
      }
    } catch {
      // Non-fatal — fall through to delta / MET
    }

    const fallbackHeartRate = fallbackHeartRateFromHealth(health);

    const resolved = resolveSessionMetrics({
      elapsedMinutes: sessionElapsedMinutes(currentSession.startedAt),
      baselineActiveCalories: currentSession.baselineActiveCalories,
      currentActiveCalories,
      weightKg,
      met,
      healthKitMetrics,
      fallbackHeartRate,
    });

    setMetrics(resolved);
    return resolved;
  }, [user?.weightKg]);

  useEffect(() => {
    if (!shouldPoll) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [shouldPoll, refresh]);

  const caloriesBurned = metrics?.caloriesBurned ?? 0;
  const heartRate = metrics?.avgHeartRate;
  const source = metrics?.source ?? null;

  return useMemo(
    () => ({
      metrics,
      isPolling,
      refresh,
      caloriesBurned,
      heartRate,
      source,
    }),
    [metrics, isPolling, refresh, caloriesBurned, heartRate, source],
  );
}
