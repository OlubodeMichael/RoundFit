import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { useHealth } from '@/hooks/use-health';
import {
  endLiveActivity,
  getCurrentLiveActivityState,
  hasActiveLiveActivity,
  isLiveActivitySupported,
  startLiveActivity,
  updateLiveActivity,
} from 'workout-live-activity';

import type { BurnActivity } from '@/components/home/burn-activity-picker';

// ── Activity → SF Symbol map ─────────────────────────────────────────────────
//
// SF Symbols are bundled with iOS. Anything not on this list falls back to
// "figure.mixed.cardio" inside the widget.

const SF_SYMBOL_FOR_ACTIVITY: Record<string, string> = {
  walk:     'figure.walk',
  run:      'figure.run',
  cycle:    'figure.outdoor.cycle',
  swim:     'figure.pool.swim',
  rowing:   'figure.rowing',
  hiit:     'figure.highintensity.intervaltraining',
  strength: 'figure.strengthtraining.traditional',
  hike:     'map',
  dance:    'figure.dance',
  yoga:     'figure.yoga',
};

// Refresh the widget at most every 8 s — Live Activities are throttled by the
// system if you push too often. Calorie deltas show up just as smoothly.
const POLL_INTERVAL_MS = 8_000;

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface ActiveWorkoutState {
  activity:     BurnActivity;
  goalCalories: number;
  startedAt:    number;        // ms — shifted forward on resume so elapsed excludes pauses
  baselineCals: number;        // active_calories at start, so we report delta
  pausedAt:     number | null; // ms when paused, null when running
}

export interface UseWorkoutLiveActivityResult {
  /** Currently-running workout, or null when nothing is active. */
  active: ActiveWorkoutState | null;
  /** True on iOS 16.1+ when Live Activities are enabled by the user. */
  isSupported: boolean;
  /** Begin tracking — starts the Dynamic Island/lock-screen widget. */
  start: (activity: BurnActivity, goalCalories: number) => Promise<void>;
  /** Freeze the timer + calorie polling. Widget stays visible, marked paused. */
  pause: () => Promise<void>;
  /** Unfreeze; startedAt shifts forward so elapsed time excludes the pause. */
  resume: () => Promise<void>;
  /** End tracking — widget is dismissed immediately. */
  end: () => Promise<void>;
}

export function useWorkoutLiveActivity(): UseWorkoutLiveActivityResult {
  const { today: healthToday } = useHealth();
  const [active, setActive]    = useState<ActiveWorkoutState | null>(null);
  const isSupported            = Platform.OS === 'ios' && isLiveActivitySupported();

  // Keep a ref to the latest health snapshot so the polling loop closes over
  // current data without re-creating itself on every health update.
  const healthRef = useRef(healthToday);
  healthRef.current = healthToday;
  const activeRef = useRef(active);
  activeRef.current = active;

  const start = useCallback(
    async (activity: BurnActivity, goalCalories: number) => {
      console.log('[LiveActivity] start called', { isSupported, activity: activity.id, goalCalories });
      if (!isSupported) {
        console.warn('[LiveActivity] not supported — iOS < 16.1 or user disabled Live Activities in Settings');
        return;
      }

      const baselineCals = healthRef.current?.active_calories ?? 0;
      const startedAt    = Date.now();
      const next: ActiveWorkoutState = {
        activity,
        goalCalories,
        startedAt,
        baselineCals,
        pausedAt: null,
      };

      try {
        const id = await startLiveActivity({
          workoutType:  activity.id,
          workoutName:  activity.label,
          workoutIcon:  SF_SYMBOL_FOR_ACTIVITY[activity.id] ?? 'figure.mixed.cardio',
          goalCalories,
          startTime:    startedAt,
        });
        console.log('[LiveActivity] started', { id });
        setActive(next);
      } catch (e) {
        console.error('[LiveActivity] start failed', e);
      }
    },
    [isSupported],
  );

  const pause = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.pausedAt != null) return;

    const pausedAt = Date.now();
    const live = healthRef.current?.active_calories ?? current.baselineCals;
    const burned = Math.max(0, live - current.baselineCals);
    const hr = healthRef.current?.avg_heart_rate
      ? Math.round(healthRef.current.avg_heart_rate)
      : undefined;

    setActive({ ...current, pausedAt });
    try {
      await updateLiveActivity({
        caloriesBurned: burned,
        heartRate:      hr,
        isActive:       false,
        pausedAt,
      });
    } catch (e) {
      console.error('[LiveActivity] pause update failed', e);
    }
  }, []);

  const resume = useCallback(async () => {
    const current = activeRef.current;
    if (!current || current.pausedAt == null) return;

    const pauseDuration = Date.now() - current.pausedAt;
    const newStartedAt  = current.startedAt + pauseDuration;
    setActive({
      ...current,
      startedAt: newStartedAt,
      pausedAt:  null,
    });
    try {
      await updateLiveActivity({
        isActive:  true,
        startTime: newStartedAt,
        pausedAt:  null,
      });
    } catch (e) {
      console.error('[LiveActivity] resume update failed', e);
    }
  }, []);

  const end = useCallback(async () => {
    const current = activeRef.current;
    console.log('[LiveActivity] end called', { hasCurrent: current != null });
    if (!current) return;

    const live = healthRef.current?.active_calories ?? current.baselineCals;
    const burned = Math.max(0, live - current.baselineCals);
    const hr = healthRef.current?.avg_heart_rate
      ? Math.round(healthRef.current.avg_heart_rate)
      : undefined;

    try {
      await endLiveActivity({ caloriesBurned: burned, heartRate: hr });
      console.log('[LiveActivity] ended');
    } catch (e) {
      console.error('[LiveActivity] end failed', e);
    } finally {
      setActive(null);
    }
  }, []);

  // Polling loop — pushes calorie + HR deltas to the widget while active (and unpaused)
  useEffect(() => {
    if (!active || active.pausedAt != null) return;

    const tick = async () => {
      const current = activeRef.current;
      if (!current) return;

      const live = healthRef.current?.active_calories ?? current.baselineCals;
      const burned = Math.max(0, live - current.baselineCals);
      const hr = healthRef.current?.avg_heart_rate
        ? Math.round(healthRef.current.avg_heart_rate)
        : undefined;

      try {
        // Don't force `isActive` here — lock-screen Pause/Resume buttons
        // mutate it natively, and the next polling tick would otherwise
        // overwrite their effect.
        await updateLiveActivity({
          caloriesBurned: burned,
          heartRate:      hr,
        });
      } catch {
        // Activity may have been dismissed by the user — ignore
      }
    };

    // Push immediately so the widget shows real values within ~1 s of start
    void tick();

    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);

  // Resync from the native activity whenever the app foregrounds — lock-screen
  // Pause/Resume/End buttons mutate native state directly and JS won't know.
  useEffect(() => {
    if (!isSupported) return;

    const sync = () => {
      const current = activeRef.current;
      if (!current) return;

      if (!hasActiveLiveActivity()) {
        // User tapped End on the lock screen.
        setActive(null);
        return;
      }

      const native = getCurrentLiveActivityState();
      if (!native) return;

      const nativePaused = native.pausedAt != null;
      const jsPaused     = current.pausedAt != null;

      if (nativePaused && !jsPaused) {
        // Lock-screen Pause.
        setActive({ ...current, pausedAt: native.pausedAt ?? Date.now() });
      } else if (!nativePaused && jsPaused) {
        // Lock-screen Resume — shift startedAt forward by the pause duration.
        const pauseDuration = Date.now() - (current.pausedAt ?? Date.now());
        setActive({
          ...current,
          startedAt: current.startedAt + pauseDuration,
          pausedAt:  null,
        });
      }
    };

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync();
    });
    return () => sub.remove();
  }, [isSupported]);

  return { active, isSupported, start, pause, resume, end };
}
