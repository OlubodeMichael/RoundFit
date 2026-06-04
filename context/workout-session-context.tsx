import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { usePostHog } from 'posthog-react-native';

import { useHealth } from '@/hooks/use-health';
import {
  cancelPhoneHealthKitWorkout,
  endPhoneHealthKitWorkout,
  startPhoneHealthKitWorkout,
} from '@/utils/healthkit';
import type {
  SessionSet,
  WorkoutSelection,
  WorkoutSession,
  WorkoutSessionState,
  WorkoutSessionStatus,
} from '@/types/workout-session';

const STORAGE_KEY = '@roundfit/active_workout_session';

interface PersistedWorkoutSession {
  session: WorkoutSession;
  status: Extract<WorkoutSessionStatus, 'active' | 'paused'>;
}

export interface WorkoutSessionContextValue extends WorkoutSessionState {
  /** True after AsyncStorage hydration on mount. */
  isStorageLoaded: boolean;
  /** Stored session from a prior run — user must recover or discard. */
  hasRecoverableSession: boolean;
  recoverableSession: WorkoutSession | null;
  start: (selection: WorkoutSelection) => Promise<WorkoutSession | null>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  end: () => Promise<void>;
  discard: () => Promise<void>;
  recover: () => Promise<void>;
  /** Strength mode — append a set and persist. */
  addSet: (set: Omit<SessionSet, 'id'>) => Promise<SessionSet | null>;
  /** Strength mode — remove a set by id and persist. */
  removeSet: (setId: string) => Promise<WorkoutSession | null>;
}

const WorkoutSessionContext = createContext<WorkoutSessionContextValue | null>(null);

function generateSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function generateSetId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSessionFromSelection(
  selection: WorkoutSelection,
  baselineActiveCalories: number,
): WorkoutSession {
  const { entry, calorieGoal, presetExercises } = selection;
  return {
    id: generateSessionId(),
    mode: entry.sessionMode,
    workoutType: entry.id,
    workoutName: entry.label,
    startedAt: Date.now(),
    pausedAt: null,
    baselineActiveCalories,
    healthkitUuid: null,
    sets: [],
    calorieGoal,
    presetExercises,
  };
}

async function persistSession(
  session: WorkoutSession,
  status: Extract<WorkoutSessionStatus, 'active' | 'paused'>,
): Promise<void> {
  const payload: PersistedWorkoutSession = { session, status };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

async function clearPersistedSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function WorkoutSessionProvider({ children }: { children: React.ReactNode }) {
  const posthog = usePostHog();
  const { today: healthToday } = useHealth();

  const [status, setStatus] = useState<WorkoutSessionStatus>('idle');
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [hasRecoverableSession, setHasRecoverableSession] = useState(false);
  const [recoverableSession, setRecoverableSession] = useState<WorkoutSession | null>(null);

  const healthRef = useRef(healthToday);
  healthRef.current = healthToday;

  const statusRef = useRef(status);
  statusRef.current = status;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;

        try {
          const parsed = JSON.parse(raw) as PersistedWorkoutSession;
          if (
            parsed?.session &&
            (parsed.status === 'active' || parsed.status === 'paused')
          ) {
            setRecoverableSession(parsed.session);
            setHasRecoverableSession(true);
          }
        } catch {
          void clearPersistedSession();
        }
      })
      .finally(() => {
        if (!cancelled) setIsStorageLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(async (selection: WorkoutSelection): Promise<WorkoutSession | null> => {
    if (statusRef.current !== 'idle' || sessionRef.current != null) return null;

    const baselineActiveCalories = healthRef.current?.active_calories ?? 0;
    let next = createSessionFromSelection(selection, baselineActiveCalories);

    const hkActivityType =
      selection.entry.healthKitActivityType ?? selection.entry.id;
    try {
      const hkUuid = await startPhoneHealthKitWorkout(
        hkActivityType,
        new Date(next.startedAt),
      );
      if (hkUuid) {
        next = { ...next, healthkitUuid: hkUuid };
      }
    } catch {
      // Non-fatal — session continues with delta / MET metrics.
    }

    setSession(next);
    sessionRef.current = next;
    setStatus('active');
    setRecoverableSession(null);
    setHasRecoverableSession(false);

    await persistSession(next, 'active');

    posthog.capture('workout_session_started', {
      activity_id: selection.entry.id,
      session_mode: selection.entry.sessionMode,
      intent: selection.intent,
      entry_surface: selection.entrySurface ?? 'log',
      has_calorie_goal: selection.calorieGoal != null && selection.calorieGoal > 0,
      has_preset_exercises: (selection.presetExercises?.length ?? 0) > 0,
    });

    return next;
  }, [posthog]);

  const addSet = useCallback(async (set: Omit<SessionSet, 'id'>): Promise<SessionSet | null> => {
    const current = sessionRef.current;
    const currentStatus = statusRef.current;
    if (
      !current ||
      current.mode !== 'strength' ||
      (currentStatus !== 'active' && currentStatus !== 'paused')
    ) {
      return null;
    }

    const fullSet: SessionSet = {
      ...set,
      id: generateSetId(),
      loggedAt: set.loggedAt ?? Date.now(),
    };
    const next: WorkoutSession = { ...current, sets: [...current.sets, fullSet] };

    setSession(next);
    sessionRef.current = next;
    await persistSession(next, currentStatus === 'paused' ? 'paused' : 'active');
    return fullSet;
  }, []);

  const removeSet = useCallback(async (setId: string): Promise<WorkoutSession | null> => {
    const current = sessionRef.current;
    const currentStatus = statusRef.current;
    if (
      !current ||
      current.mode !== 'strength' ||
      (currentStatus !== 'active' && currentStatus !== 'paused')
    ) {
      return null;
    }

    const nextSets = current.sets.filter((s) => s.id !== setId);
    if (nextSets.length === current.sets.length) return null;

    const next: WorkoutSession = { ...current, sets: nextSets };

    setSession(next);
    sessionRef.current = next;
    await persistSession(next, currentStatus === 'paused' ? 'paused' : 'active');
    return next;
  }, []);

  const pause = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || statusRef.current !== 'active' || current.pausedAt != null) return;

    const pausedAt = Date.now();
    const next: WorkoutSession = { ...current, pausedAt };

    setSession(next);
    setStatus('paused');
    await persistSession(next, 'paused');
  }, []);

  const resume = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.pausedAt == null) return;
    if (statusRef.current !== 'paused' && statusRef.current !== 'active') return;

    const pauseDuration = Date.now() - current.pausedAt;
    const next: WorkoutSession = {
      ...current,
      startedAt: current.startedAt + pauseDuration,
      pausedAt: null,
    };

    setSession(next);
    setStatus('active');
    await persistSession(next, 'active');
  }, []);

  const end = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || statusRef.current === 'idle' || statusRef.current === 'completing') {
      return;
    }

    setStatus('completing');

    try {
      await endPhoneHealthKitWorkout(new Date());
    } catch {
      // Best-effort — session teardown continues.
    }

    await clearPersistedSession();
    setRecoverableSession(null);
    setHasRecoverableSession(false);
    setSession(null);
    setStatus('idle');
  }, []);

  const discard = useCallback(async () => {
    cancelPhoneHealthKitWorkout();
    await clearPersistedSession();
    setRecoverableSession(null);
    setHasRecoverableSession(false);
    setSession(null);
    setStatus('idle');
  }, []);

  const recover = useCallback(async () => {
    if (!recoverableSession || sessionRef.current != null) return;

    const restoredStatus: Extract<WorkoutSessionStatus, 'active' | 'paused'> =
      recoverableSession.pausedAt != null ? 'paused' : 'active';

    setSession(recoverableSession);
    setStatus(restoredStatus);
    setRecoverableSession(null);
    setHasRecoverableSession(false);
    await persistSession(recoverableSession, restoredStatus);
  }, [recoverableSession]);

  const value: WorkoutSessionContextValue = {
    status,
    session,
    isStorageLoaded,
    hasRecoverableSession,
    recoverableSession,
    start,
    pause,
    resume,
    end,
    discard,
    recover,
    addSet,
    removeSet,
  };

  return (
    <WorkoutSessionContext.Provider value={value}>
      {children}
    </WorkoutSessionContext.Provider>
  );
}

export function useWorkoutSession(): WorkoutSessionContextValue {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) {
    throw new Error('useWorkoutSession must be used inside <WorkoutSessionProvider>');
  }
  return ctx;
}
