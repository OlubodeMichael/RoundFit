import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { getCatalogEntryById } from '@/config/workout-catalog';
import { useWorkoutSession } from '@/context/workout-session-context';
import { useHealth } from '@/hooks/use-health';
import {
  resolveSessionMetricsDelta,
  useSessionMetrics,
} from '@/hooks/use-session-metrics';
import {
  endLiveActivity,
  getCurrentLiveActivityState,
  hasActiveLiveActivity,
  isLiveActivitySupported,
  startLiveActivity,
  updateLiveActivity,
} from 'workout-live-activity';

import type { BurnActivity } from '@/components/home/burn-activity-picker';

const POLL_INTERVAL_MS = 8_000;

export interface ActiveWorkoutState {
  activity:     BurnActivity;
  goalCalories: number;
  startedAt:    number;
  baselineCals: number;
  pausedAt:     number | null;
}

export interface UseWorkoutLiveActivityResult {
  active: ActiveWorkoutState | null;
  isSupported: boolean;
  start: (activity: BurnActivity, goalCalories: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  end: () => Promise<void>;
}

function liveMetricsPayload(
  sessionMetrics: ReturnType<typeof useSessionMetrics>,
  baselineCals: number,
  healthToday: ReturnType<typeof useHealth>['today'],
): { caloriesBurned: number; heartRate?: number } {
  if (sessionMetrics.metrics != null) {
    return {
      caloriesBurned: sessionMetrics.caloriesBurned,
      heartRate:      sessionMetrics.heartRate,
    };
  }
  const live = healthToday?.active_calories ?? baselineCals;
  const burned = Math.max(0, Math.round(live - baselineCals));
  const hr = healthToday?.avg_heart_rate
    ? Math.round(healthToday.avg_heart_rate)
    : undefined;
  return { caloriesBurned: burned, heartRate: hr };
}

function useWorkoutLiveActivityController(): UseWorkoutLiveActivityResult {
  const { today: healthToday } = useHealth();
  const workoutSession = useWorkoutSession();
  const sessionMetrics = useSessionMetrics();
  const [active, setActive] = useState<ActiveWorkoutState | null>(null);
  const isSupported = Platform.OS === 'ios' && isLiveActivitySupported();

  const healthRef = useRef(healthToday);
  healthRef.current = healthToday;
  const activeRef = useRef(active);
  activeRef.current = active;
  const sessionMetricsRef = useRef(sessionMetrics);
  sessionMetricsRef.current = sessionMetrics;

  const start = useCallback(
    async (activity: BurnActivity, goalCalories: number) => {
      if (!isSupported) return;
      // One live session at a time — ignore a start while one is already running,
      // no matter how many times start is invoked (e.g. rapid taps from the watch).
      if (activeRef.current || hasActiveLiveActivity()) return;

      const baselineCals = healthRef.current?.active_calories ?? 0;
      const startedAt = Date.now();
      const entry = getCatalogEntryById(activity.id);
      const next: ActiveWorkoutState = {
        activity,
        goalCalories,
        startedAt,
        baselineCals,
        pausedAt: null,
      };

      try {
        await startLiveActivity({
          workoutType: activity.id,
          workoutName: activity.label,
          workoutIcon: entry?.sfSymbol ?? 'figure.mixed.cardio',
          goalCalories,
          startTime: startedAt,
        });
        setActive(next);
        // NOTE: intentionally does NOT start a workout session here. Starting one
        // triggers use-workout-session-live-activity to spawn a SECOND Live Activity
        // (the "sets" one), so a single start showed two activities. Callers that want a
        // logged session (e.g. the home screen) start it explicitly.
      } catch {
        // Live Activity may be disabled or dismissed
      }
    },
    [isSupported],
  );

  const pause = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.pausedAt != null) return;

    const pausedAt = Date.now();
    const { caloriesBurned, heartRate } = liveMetricsPayload(
      sessionMetricsRef.current,
      current.baselineCals,
      healthRef.current,
    );

    setActive({ ...current, pausedAt });
    if (workoutSession.session?.mode === 'cardio') {
      void workoutSession.pause();
    }
    try {
      await updateLiveActivity({
        caloriesBurned,
        heartRate,
        isActive: false,
        pausedAt,
      });
    } catch {
      // Activity may have been dismissed
    }
  }, [workoutSession]);

  const resume = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.pausedAt == null) return;

    const pauseDuration = Date.now() - current.pausedAt;
    const newStartedAt = current.startedAt + pauseDuration;
    setActive({
      ...current,
      startedAt: newStartedAt,
      pausedAt: null,
    });
    if (workoutSession.session?.mode === 'cardio') {
      void workoutSession.resume();
    }
    try {
      await updateLiveActivity({
        isActive: true,
        startTime: newStartedAt,
        pausedAt: null,
      });
    } catch {
      // Activity may have been dismissed
    }
  }, [workoutSession]);

  const end = useCallback(async () => {
    const current = activeRef.current;
    if (!current) return;

    const ctxSession = workoutSession.session;
    const { caloriesBurned, heartRate } = ctxSession
      ? (() => {
          const resolved = resolveSessionMetricsDelta(ctxSession, healthRef.current);
          return {
            caloriesBurned: resolved.caloriesBurned,
            heartRate: resolved.avgHeartRate,
          };
        })()
      : liveMetricsPayload(
          sessionMetricsRef.current,
          current.baselineCals,
          healthRef.current,
        );

    try {
      await endLiveActivity({ caloriesBurned, heartRate });
    } catch {
      // Activity may have been dismissed
    } finally {
      setActive(null);
    }
  }, [workoutSession]);

  useEffect(() => {
    if (!active || active.pausedAt != null) return;

    const tick = async () => {
      const current = activeRef.current;
      if (!current) return;

      const { caloriesBurned, heartRate } = liveMetricsPayload(
        sessionMetricsRef.current,
        current.baselineCals,
        healthRef.current,
      );

      try {
        await updateLiveActivity({ caloriesBurned, heartRate });
      } catch {
        // Activity may have been dismissed by the user
      }
    };

    void tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);

  const syncFromNative = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;

    if (!hasActiveLiveActivity()) {
      setActive(null);
      return;
    }

    const native = getCurrentLiveActivityState();
    if (!native) return;

    const nativePaused = native.pausedAt != null;
    const jsPaused = current.pausedAt != null;

    if (nativePaused && !jsPaused) {
      setActive({ ...current, pausedAt: native.pausedAt ?? Date.now() });
    } else if (!nativePaused && jsPaused) {
      const pauseDuration = Date.now() - (current.pausedAt ?? Date.now());
      setActive({
        ...current,
        startedAt: current.startedAt + pauseDuration,
        pausedAt: null,
      });
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') syncFromNative();
    });
    return () => sub.remove();
  }, [isSupported, syncFromNative]);

  useEffect(() => {
    if (!isSupported || !active) return;
    const id = setInterval(syncFromNative, 3_000);
    return () => clearInterval(id);
  }, [isSupported, active, syncFromNative]);

  return { active, isSupported, start, pause, resume, end };
}

// ── Shared context ───────────────────────────────────────────────────────────
// A single live-activity controller for the whole app, so the home screen, the
// burn-coach context, and the Apple Watch sync all read and mutate the SAME workout
// state. (Previously each caller had its own useState copy, so a pause from the watch
// never reached the phone's copy.)

const WorkoutLiveActivityContext = createContext<UseWorkoutLiveActivityResult | null>(null);

export function WorkoutLiveActivityProvider({ children }: { children: ReactNode }) {
  const value = useWorkoutLiveActivityController();
  return (
    <WorkoutLiveActivityContext.Provider value={value}>
      {children}
    </WorkoutLiveActivityContext.Provider>
  );
}

export function useWorkoutLiveActivity(): UseWorkoutLiveActivityResult {
  const ctx = useContext(WorkoutLiveActivityContext);
  if (!ctx) {
    throw new Error(
      'useWorkoutLiveActivity must be used within a WorkoutLiveActivityProvider',
    );
  }
  return ctx;
}
