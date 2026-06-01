import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  endSessionLiveActivity,
  getCurrentSessionLiveActivityState,
  hasActiveSessionLiveActivity,
  isLiveActivitySupported,
  startSessionLiveActivity,
  updateSessionLiveActivity,
} from 'workout-live-activity';

// ── Set / session models ────────────────────────────────────────────────────

export interface SessionSet {
  /** Stable client-side id, generated when the set is logged. */
  id:        string;
  exercise:  string;
  reps:      number;
  /** Weight in kilograms. Pass 0 for bodyweight moves. */
  weightKg:  number;
  /** Local ms timestamp the set was logged. */
  loggedAt:  number;
}

export interface ActiveSessionState {
  workoutType:  string;
  workoutName:  string;
  workoutIcon:  string; // SF Symbol used by the widget
  /** Effective start. Shifted forward on resume so paused time is excluded. */
  startedAt:    number;
  /** ms timestamp when paused, null when running. */
  pausedAt:     number | null;
  /** All sets logged this session, in insertion order. */
  sets:         SessionSet[];
}

export interface UseWorkoutSessionLiveActivityResult {
  active:        ActiveSessionState | null;
  isSupported:   boolean;

  /**
   * Monotonically increasing counter incremented every time something
   * external (e.g. a Dynamic Island / lock-screen tap deep link) asks the
   * UI to open the live-session sheet. Consumers watch for changes via
   * useEffect and open the sheet when the value goes up.
   */
  openSheetSignal: number;
  /** Fire from deep-link routes to bump `openSheetSignal`. */
  requestOpenSheet: () => void;

  /** Begin a session. Starts the ticking timer and shows the Live Activity. */
  start: (params: {
    workoutType: string;
    workoutName: string;
    workoutIcon?: string;
  }) => Promise<void>;

  /** Append a set; pushes the new count + "last set" line to the widget. */
  addSet: (set: Omit<SessionSet, 'id' | 'loggedAt'>) => Promise<void>;

  /** Remove a set by id (e.g. mis-entered). Recomputes volume. */
  removeSet: (setId: string) => Promise<void>;

  /** Freeze the timer; widget shows PAUSED + grey colors. */
  pause:  () => Promise<void>;
  resume: () => Promise<void>;

  /** End the session. Dismisses the Live Activity, returns the final state. */
  end:    () => Promise<ActiveSessionState | null>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeVolume(sets: SessionSet[]): number {
  return sets.reduce((acc, s) => acc + (s.weightKg > 0 ? s.weightKg * s.reps : 0), 0);
}

function generateId(): string {
  // Tiny non-crypto id, enough to dedupe locally.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Implementation hook (internal) ───────────────────────────────────────────
// Holds the single source of truth for the active session. Mount via
// <WorkoutSessionLiveActivityProvider> at the app root so every consumer
// sees the same state. Consumers should call useWorkoutSessionLiveActivity().

function useWorkoutSessionLiveActivityImpl(): UseWorkoutSessionLiveActivityResult {
  const [active, setActive] = useState<ActiveSessionState | null>(null);
  const [openSheetSignal, setOpenSheetSignal] = useState(0);
  const isSupported         = Platform.OS === 'ios' && isLiveActivitySupported();

  const requestOpenSheet = useCallback(() => {
    setOpenSheetSignal((n) => n + 1);
  }, []);

  const activeRef = useRef(active);
  activeRef.current = active;

  const start = useCallback(
    async ({
      workoutType,
      workoutName,
      workoutIcon = 'dumbbell.fill',
    }: {
      workoutType: string;
      workoutName: string;
      workoutIcon?: string;
    }) => {
      if (!isSupported) {
        console.warn('[SessionLA] not supported (iOS < 16.1 or disabled)');
        return;
      }

      const startedAt = Date.now();
      const next: ActiveSessionState = {
        workoutType,
        workoutName,
        workoutIcon,
        startedAt,
        pausedAt: null,
        sets: [],
      };

      try {
        const id = await startSessionLiveActivity({
          workoutType,
          workoutName,
          workoutIcon,
          startTime: startedAt,
        });
        console.log('[SessionLA] started', { id });
        setActive(next);
      } catch (e) {
        console.error('[SessionLA] start failed', e);
      }
    },
    [isSupported],
  );

  const addSet = useCallback(
    async (set: Omit<SessionSet, 'id' | 'loggedAt'>) => {
      const current = activeRef.current;
      if (!current) return;

      const fullSet: SessionSet = {
        ...set,
        id:       generateId(),
        loggedAt: Date.now(),
      };
      const nextSets   = [...current.sets, fullSet];
      const nextVolume = computeVolume(nextSets);

      setActive({ ...current, sets: nextSets });
      try {
        await updateSessionLiveActivity({
          setCount:        nextSets.length,
          lastExercise:    set.exercise,
          lastSetReps:     set.reps,
          lastSetWeightKg: set.weightKg,
          totalVolumeKg:   nextVolume,
        });
      } catch (e) {
        console.error('[SessionLA] addSet update failed', e);
      }
    },
    [],
  );

  const removeSet = useCallback(async (setId: string) => {
    const current = activeRef.current;
    if (!current) return;

    const nextSets   = current.sets.filter((s) => s.id !== setId);
    if (nextSets.length === current.sets.length) return; // no-op
    const nextVolume = computeVolume(nextSets);
    const lastSet   = nextSets[nextSets.length - 1];

    setActive({ ...current, sets: nextSets });
    try {
      // null clears the "last set" line when removal empties the session.
      await updateSessionLiveActivity({
        setCount:        nextSets.length,
        lastExercise:    lastSet?.exercise ?? null,
        lastSetReps:     lastSet?.reps     ?? null,
        lastSetWeightKg: lastSet?.weightKg ?? null,
        totalVolumeKg:   nextVolume,
      });
    } catch (e) {
      console.error('[SessionLA] removeSet update failed', e);
    }
  }, []);

  const pause = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.pausedAt != null) return;

    const pausedAt = Date.now();
    setActive({ ...current, pausedAt });
    try {
      await updateSessionLiveActivity({ isActive: false, pausedAt });
    } catch (e) {
      console.error('[SessionLA] pause failed', e);
    }
  }, []);

  const resume = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.pausedAt == null) return;

    const pauseDuration = Date.now() - current.pausedAt;
    const newStartedAt  = current.startedAt + pauseDuration;
    setActive({ ...current, startedAt: newStartedAt, pausedAt: null });
    try {
      await updateSessionLiveActivity({
        isActive:  true,
        startTime: newStartedAt,
        pausedAt:  null,
      });
    } catch (e) {
      console.error('[SessionLA] resume failed', e);
    }
  }, []);

  const end = useCallback(async (): Promise<ActiveSessionState | null> => {
    const current = activeRef.current;
    if (!current) return null;

    const volume = computeVolume(current.sets);
    try {
      await endSessionLiveActivity({
        setCount:      current.sets.length,
        totalVolumeKg: volume,
      });
    } catch (e) {
      console.error('[SessionLA] end failed', e);
    } finally {
      setActive(null);
    }
    return current;
  }, []);

  // Resync from the native activity (cold reattach + foreground refresh).
  const syncFromNative = useCallback(() => {
    const current = activeRef.current;
    if (!current) return;

    // Tri-state: explicit `false` means native confirms no session; `null`
    // means native couldn't be queried (stale binary, missing function).
    // Only drop JS state on explicit false. Otherwise the polling loop
    // would clear the session every 3 seconds whenever the native module
    // hasn't been rebuilt with the latest functions.
    const hasActive = hasActiveSessionLiveActivity();
    if (hasActive === false) {
      // The Live Activity was dismissed externally (e.g. user swiped away).
      setActive(null);
      return;
    }
    if (hasActive === null) {
      // Native side can't answer; keep current JS state untouched.
      return;
    }

    const native = getCurrentSessionLiveActivityState();
    if (!native) return;

    const nativePaused = native.pausedAt != null;
    const jsPaused     = current.pausedAt != null;
    if (nativePaused && !jsPaused) {
      setActive({ ...current, pausedAt: native.pausedAt ?? Date.now() });
    } else if (!nativePaused && jsPaused) {
      const pauseDuration = Date.now() - (current.pausedAt ?? Date.now());
      setActive({
        ...current,
        startedAt: current.startedAt + pauseDuration,
        pausedAt:  null,
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

// ── Context + Provider ──────────────────────────────────────────────────────
// Hoist the impl hook into a Context so every consumer (workout tab banner,
// session sheet, summary toast, etc.) shares the same `active` state. Without
// this each call site would get its own useState, and the banner on the
// workout tab would never see the session that the sheet started.

const WorkoutSessionLiveActivityContext =
  createContext<UseWorkoutSessionLiveActivityResult | null>(null);

export function WorkoutSessionLiveActivityProvider(
  { children }: { children: React.ReactNode },
) {
  const value = useWorkoutSessionLiveActivityImpl();
  return React.createElement(
    WorkoutSessionLiveActivityContext.Provider,
    { value },
    children,
  );
}

/**
 * Shared hook backed by <WorkoutSessionLiveActivityProvider>.
 * The provider must be mounted above any consumer (see `app/_layout.tsx`).
 */
export function useWorkoutSessionLiveActivity(): UseWorkoutSessionLiveActivityResult {
  const ctx = useContext(WorkoutSessionLiveActivityContext);
  if (!ctx) {
    throw new Error(
      'useWorkoutSessionLiveActivity must be used inside <WorkoutSessionLiveActivityProvider>',
    );
  }
  return ctx;
}
