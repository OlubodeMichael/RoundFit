import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useHealth } from '@/hooks/use-health';
import {
  endLiveActivity,
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
  startedAt:    number;   // ms
  baselineCals: number;   // active_calories at start, so we report delta
}

export interface UseWorkoutLiveActivityResult {
  /** Currently-running workout, or null when nothing is active. */
  active: ActiveWorkoutState | null;
  /** True on iOS 16.1+ when Live Activities are enabled by the user. */
  isSupported: boolean;
  /** Begin tracking — starts the Dynamic Island/lock-screen widget. */
  start: (activity: BurnActivity, goalCalories: number) => Promise<void>;
  /** End tracking — widget remains visible as a 5-min summary, then dismisses. */
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
      if (!isSupported) return;

      const baselineCals = healthRef.current?.active_calories ?? 0;
      const startedAt    = Date.now();
      const next: ActiveWorkoutState = {
        activity,
        goalCalories,
        startedAt,
        baselineCals,
      };

      try {
        await startLiveActivity({
          workoutType:  activity.id,
          workoutName:  activity.label,
          workoutIcon:  SF_SYMBOL_FOR_ACTIVITY[activity.id] ?? 'figure.mixed.cardio',
          goalCalories,
          startTime:    startedAt,
        });
        setActive(next);
      } catch {
        // Permission denied / iOS < 16.1 — fail silently, user gets no widget
      }
    },
    [isSupported],
  );

  const end = useCallback(async () => {
    const current = activeRef.current;
    if (!current) return;

    const live = healthRef.current?.active_calories ?? current.baselineCals;
    const burned = Math.max(0, live - current.baselineCals);
    const hr = healthRef.current?.avg_heart_rate
      ? Math.round(healthRef.current.avg_heart_rate)
      : undefined;

    try {
      await endLiveActivity({ caloriesBurned: burned, heartRate: hr });
    } finally {
      setActive(null);
    }
  }, []);

  // Polling loop — pushes calorie + HR deltas to the widget while active
  useEffect(() => {
    if (!active) return;

    const tick = async () => {
      const current = activeRef.current;
      if (!current) return;

      const live = healthRef.current?.active_calories ?? current.baselineCals;
      const burned = Math.max(0, live - current.baselineCals);
      const hr = healthRef.current?.avg_heart_rate
        ? Math.round(healthRef.current.avg_heart_rate)
        : undefined;

      try {
        await updateLiveActivity({
          caloriesBurned: burned,
          heartRate:      hr,
          isActive:       true,
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

  return { active, isSupported, start, end };
}
