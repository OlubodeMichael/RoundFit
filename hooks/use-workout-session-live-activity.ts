import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { getCatalogEntryById } from '@/config/workout-catalog';
import { useWorkoutSession } from '@/context/workout-session-context';
import { useSessionMetrics } from '@/hooks/use-session-metrics';
import type { WorkoutSelection, WorkoutSession } from '@/types/workout-session';
import {
  endSessionLiveActivity,
  getCurrentSessionLiveActivityState,
  hasActiveSessionLiveActivity,
  isLiveActivitySupported,
  startSessionLiveActivity,
  updateSessionLiveActivity,
} from 'workout-live-activity';

export type { SessionSet } from '@/types/workout-session';
import type { SessionSet } from '@/types/workout-session';

// ── Session view model (backward-compatible with LiveSessionSheet) ─────────

export interface ActiveSessionState {
  workoutType: string;
  workoutName: string;
  workoutIcon: string;
  startedAt: number;
  pausedAt: number | null;
  sets: SessionSet[];
}

export interface UseWorkoutSessionLiveActivityResult {
  active: ActiveSessionState | null;
  isSupported: boolean;
  openSheetSignal: number;
  requestOpenSheet: () => void;
  start: (params: {
    workoutType: string;
    workoutName: string;
    workoutIcon?: string;
  }) => Promise<void>;
  addSet: (set: Omit<SessionSet, 'id' | 'loggedAt'>) => Promise<void>;
  removeSet: (setId: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Ends the Live Activity widget; returns session snapshot for persistence. */
  end: () => Promise<ActiveSessionState | null>;
}

const POLL_INTERVAL_MS = 8_000;

function computeVolume(sets: SessionSet[]): number {
  return sets.reduce((acc, s) => acc + (s.weightKg > 0 ? s.weightKg * s.reps : 0), 0);
}

function liveMetricsFields(
  metrics: ReturnType<typeof useSessionMetrics>,
): Pick<
  Parameters<typeof updateSessionLiveActivity>[0],
  'caloriesBurned' | 'heartRate'
> {
  if (metrics.metrics == null) return {};
  return {
    caloriesBurned: metrics.caloriesBurned,
    ...(metrics.heartRate != null ? { heartRate: metrics.heartRate } : {}),
  };
}

function sessionToActive(session: WorkoutSession, workoutIcon?: string): ActiveSessionState {
  const entry = getCatalogEntryById(session.workoutType);
  return {
    workoutType: session.workoutType,
    workoutName: session.workoutName,
    workoutIcon: workoutIcon ?? entry?.sfSymbol ?? 'dumbbell.fill',
    startedAt: session.startedAt,
    pausedAt: session.pausedAt,
    sets: session.sets,
  };
}

function buildSelectionFromLegacyParams(params: {
  workoutType: string;
  workoutName: string;
  workoutIcon?: string;
}): WorkoutSelection {
  const entry = getCatalogEntryById(params.workoutType);
  if (entry) {
    return { entry, intent: 'live' };
  }
  return {
    entry: {
      id: params.workoutType,
      label: params.workoutName,
      icon: 'barbell-outline',
      sfSymbol: params.workoutIcon ?? 'dumbbell.fill',
      backendType: 'other',
      sessionMode: 'strength',
      supportsSets: true,
    },
    intent: 'live',
  };
}

async function pushSetMetricsToLiveActivity(sets: SessionSet[]): Promise<void> {
  const lastSet = sets[sets.length - 1];
  await updateSessionLiveActivity({
    setCount: sets.length,
    lastExercise: lastSet?.exercise ?? null,
    lastSetReps: lastSet?.reps ?? null,
    lastSetWeightKg: lastSet?.weightKg ?? null,
    totalVolumeKg: computeVolume(sets),
  });
}

function useWorkoutSessionLiveActivityImpl(): UseWorkoutSessionLiveActivityResult {
  const workoutSession = useWorkoutSession();
  const { session, status, start: contextStart, pause: contextPause, resume: contextResume, addSet: contextAddSet, removeSet: contextRemoveSet } =
    workoutSession;
  const sessionMetrics = useSessionMetrics();

  const [openSheetSignal, setOpenSheetSignal] = useState(0);
  const isSupported = Platform.OS === 'ios' && isLiveActivitySupported();
  const laSessionIdRef = useRef<string | null>(null);
  const sessionMetricsRef = useRef(sessionMetrics);
  sessionMetricsRef.current = sessionMetrics;

  const requestOpenSheet = useCallback(() => {
    setOpenSheetSignal((n) => n + 1);
  }, []);

  const active = useMemo((): ActiveSessionState | null => {
    if (!session || (status !== 'active' && status !== 'paused')) return null;
    return sessionToActive(session);
  }, [session, status]);

  const activeRef = useRef(active);
  activeRef.current = active;

  const ensureLiveActivityStarted = useCallback(
    async (s: WorkoutSession, workoutIcon?: string) => {
      if (!isSupported || laSessionIdRef.current === s.id) return;

      // Dismiss any stale lock-screen card before requesting a new activity.
      try {
        await endSessionLiveActivity();
      } catch {
        // Live Activity may be disabled or already dismissed
      }
      laSessionIdRef.current = null;

      const icon = workoutIcon ?? getCatalogEntryById(s.workoutType)?.sfSymbol ?? 'dumbbell.fill';
      try {
        await startSessionLiveActivity({
          workoutType: s.workoutType,
          workoutName: s.workoutName,
          workoutIcon: icon,
          startTime: s.startedAt,
        });
        if (s.sets.length > 0) {
          await pushSetMetricsToLiveActivity(s.sets);
        }
        if (s.pausedAt != null) {
          await updateSessionLiveActivity({ isActive: false, pausedAt: s.pausedAt });
        }
        laSessionIdRef.current = s.id;
      } catch {
        // Live Activity may be disabled or dismissed
      }
    },
    [isSupported],
  );

  useEffect(() => {
    if (!session || session.mode !== 'strength') return;
    if (status !== 'active' && status !== 'paused') return;
    void ensureLiveActivityStarted(session);
  }, [session, status, ensureLiveActivityStarted]);

  useEffect(() => {
    if (status === 'idle') {
      laSessionIdRef.current = null;
    }
  }, [status]);

  const start = useCallback(
    async ({
      workoutType,
      workoutName,
      workoutIcon,
    }: {
      workoutType: string;
      workoutName: string;
      workoutIcon?: string;
    }) => {
      const selection = buildSelectionFromLegacyParams({ workoutType, workoutName, workoutIcon });
      const created = await contextStart(selection);
      if (!created) return;

      await ensureLiveActivityStarted(created, workoutIcon);
    },
    [isSupported, contextStart, ensureLiveActivityStarted],
  );

  const addSet = useCallback(
    async (set: Omit<SessionSet, 'id' | 'loggedAt'>) => {
      const next = await contextAddSet({ ...set, loggedAt: Date.now() });
      if (!next) return;

      const current = activeRef.current;
      const sets = current ? [...current.sets, next] : [next];
      try {
        await pushSetMetricsToLiveActivity(sets);
        await updateSessionLiveActivity(liveMetricsFields(sessionMetricsRef.current));
      } catch {
        // Activity may have been dismissed
      }
    },
    [contextAddSet],
  );

  const removeSet = useCallback(
    async (setId: string) => {
      const updated = await contextRemoveSet(setId);
      if (!updated) return;

      try {
        await pushSetMetricsToLiveActivity(updated.sets);
        await updateSessionLiveActivity(liveMetricsFields(sessionMetricsRef.current));
      } catch {
        // Activity may have been dismissed
      }
    },
    [contextRemoveSet],
  );

  const pause = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.pausedAt != null) return;

    await contextPause();
    try {
      await updateSessionLiveActivity({
        isActive: false,
        pausedAt: Date.now(),
        ...liveMetricsFields(sessionMetricsRef.current),
      });
    } catch {
      // Activity may have been dismissed
    }
  }, [contextPause]);

  const resume = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.pausedAt == null) return;

    const pauseDuration = Date.now() - current.pausedAt;
    const newStartedAt = current.startedAt + pauseDuration;

    await contextResume();
    try {
      await updateSessionLiveActivity({
        isActive: true,
        startTime: newStartedAt,
        pausedAt: null,
        ...liveMetricsFields(sessionMetricsRef.current),
      });
    } catch {
      // Activity may have been dismissed
    }
  }, [contextResume]);

  const end = useCallback(async (): Promise<ActiveSessionState | null> => {
    const current = activeRef.current;
    if (!current) return null;

    const volume = computeVolume(current.sets);
    try {
      await endSessionLiveActivity({
        setCount: current.sets.length,
        totalVolumeKg: volume,
      });
    } catch {
      // Activity may have been dismissed
    } finally {
      laSessionIdRef.current = null;
    }
    return current;
  }, []);

  const syncFromNative = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;

    const hasActive = hasActiveSessionLiveActivity();
    if (hasActive === false) return;
    if (hasActive === null) return;

    const native = getCurrentSessionLiveActivityState();
    if (!native) return;

    const nativePaused = native.pausedAt != null;
    const jsPaused = current.pausedAt != null;
    if (nativePaused && !jsPaused) {
      void contextPause();
    } else if (!nativePaused && jsPaused) {
      void contextResume();
    }
  }, [contextPause, contextResume]);

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

  useEffect(() => {
    if (!isSupported || !active || active.pausedAt != null) return;

    const tick = async () => {
      const fields = liveMetricsFields(sessionMetricsRef.current);
      if (Object.keys(fields).length === 0) return;
      try {
        await updateSessionLiveActivity(fields);
      } catch {
        // Activity may have been dismissed
      }
    };

    void tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isSupported, active]);

  return {
    active,
    isSupported,
    start,
    addSet,
    removeSet,
    pause,
    resume,
    end,
    openSheetSignal,
    requestOpenSheet,
  };
}

const WorkoutSessionLiveActivityContext =
  createContext<UseWorkoutSessionLiveActivityResult | null>(null);

export function WorkoutSessionLiveActivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useWorkoutSessionLiveActivityImpl();
  return React.createElement(
    WorkoutSessionLiveActivityContext.Provider,
    { value },
    children,
  );
}

export function useWorkoutSessionLiveActivity(): UseWorkoutSessionLiveActivityResult {
  const ctx = useContext(WorkoutSessionLiveActivityContext);
  if (!ctx) {
    throw new Error(
      'useWorkoutSessionLiveActivity must be used inside <WorkoutSessionLiveActivityProvider>',
    );
  }
  return ctx;
}
