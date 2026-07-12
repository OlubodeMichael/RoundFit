import { useEffect, useMemo, useRef } from 'react';

import { getBurnCatalogEntries, getCatalogEntryById } from '@/config/workout-catalog';
import { catalogEntryToBurnActivity } from '@/utils/burn-prescription';
import { useDailyCoaching } from '@/hooks/use-daily-coaching';
import { useFood } from '@/context/food-context';
import { useHealth } from '@/hooks/use-health';
import { useRecovery } from '@/hooks/use-recovery';
import { useSummary } from '@/hooks/use-summary';
import { useWater } from '@/hooks/use-water';
import { useWorkoutLiveActivity } from '@/hooks/use-workout-live-activity';
import type { WatchQuickPick, WatchWorkoutState } from '@/types/watch';
import { getLocalDateString } from '@/utils/date';
import {
  loadProcessedIds,
  rememberProcessedId,
  shouldApplyWatchAction,
} from '@/utils/watch-action-dedup';
import {
  buildWatchSnapshot,
  sfSymbolForWorkout,
  watchSnapshotFingerprint,
} from '@/utils/watch-snapshot';
import {
  addWatchActionListener,
  pushWatchSnapshot,
} from '@/modules/watch-bridge/src';

/** Water +1 step. TODO(watch open-q #1): read the user's configured cup size. */
const WATER_CUP_ML = 250;
/** Default protein goal when the daily summary hasn't provided a target yet. */
const DEFAULT_PROTEIN_GOAL = 150;
/** Fallback calorie goal for a watch-started burn when the watch sends none. */
const DEFAULT_BURN_GOAL_CAL = 150;

/**
 * Phone-side Apple Watch sync. Mount ONCE near the app root (inside the data
 * providers). Pushes the wrist snapshot whenever a visible value changes, and applies
 * inbound actions (Phase 1: water) through the phone's existing write paths with
 * fingerprint-free id dedup so a queued/replayed tap never double-logs.
 *
 * Entirely inert until the native `watch-bridge` module ships (post-prebuild): the
 * pushes and the listener no-op, so mounting it now is safe.
 */
export function useWatchSync(): void {
  const { display, today: recoveryToday } = useRecovery();
  const { today: healthToday } = useHealth();
  const { decision, message } = useDailyCoaching();
  const { mealGoal, totalCalories, totalProtein } = useFood();
  const { daily } = useSummary();
  const { totalMl, goalMl, logWater } = useWater();
  const {
    active,
    start: startLiveWorkout,
    end: endLiveWorkout,
    pause: pauseLiveWorkout,
    resume: resumeLiveWorkout,
  } = useWorkoutLiveActivity();

  const quickPicks = useMemo<WatchQuickPick[]>(
    () =>
      getBurnCatalogEntries().map((e) => ({
        id: e.id,
        label: e.label,
        sfSymbol: e.sfSymbol ?? sfSymbolForWorkout(e.id),
        mode: e.sessionMode,
      })),
    [],
  );

  const workout = useMemo<WatchWorkoutState>(() => {
    if (!active) return { active: false };
    return {
      active: true,
      paused: active.pausedAt != null,
      activityId: active.activity.id,
      label: active.activity.label,
      startedAt: new Date(active.startedAt).toISOString(),
    };
  }, [active]);

  const proteinGoal = daily?.protein_target ?? DEFAULT_PROTEIN_GOAL;

  const snapshot = useMemo(
    () =>
      buildWatchSnapshot({
        date: getLocalDateString(),
        readinessScore: display.score,
        directive: decision?.directive ?? null,
        readinessReason: display.reason,
        sleepScore: display.sleepScore,
        sleepHours: recoveryToday?.sleep_hours ?? healthToday?.sleep_hours ?? null,
        deepSleepHours:
          recoveryToday?.deep_sleep_hours ?? healthToday?.deep_sleep_hours ?? null,
        remSleepHours:
          recoveryToday?.rem_sleep_hours ?? healthToday?.rem_sleep_hours ?? null,
        strainScore: display.strainScore,
        soreness: recoveryToday?.soreness_level ?? null,
        hrv: recoveryToday?.hrv ?? healthToday?.hrv ?? null,
        restingHr:
          recoveryToday?.resting_heart_rate ??
          healthToday?.resting_heart_rate ??
          null,
        coachingTitle: message?.title ?? null,
        coachingMessage: message?.message ?? null,
        caloriesRemaining: mealGoal - totalCalories,
        calorieGoal: mealGoal,
        proteinRemaining: proteinGoal - totalProtein,
        proteinGoal,
        waterCurrentMl: totalMl,
        waterGoalMl: goalMl,
        cupMl: WATER_CUP_ML,
        steps: healthToday?.steps ?? null,
        caloriesBurned: healthToday?.total_calories_burned ?? null,
        workout,
        quickPicks,
      }),
    [
      display.score,
      display.reason,
      display.sleepScore,
      display.strainScore,
      recoveryToday,
      healthToday,
      decision?.directive,
      message?.title,
      message?.message,
      mealGoal,
      totalCalories,
      totalProtein,
      proteinGoal,
      totalMl,
      goalMl,
      workout,
      quickPicks,
    ],
  );

  // Push only when the user-visible content changes (fingerprint excludes updatedAt).
  const lastFingerprint = useRef<string | null>(null);
  useEffect(() => {
    const fp = watchSnapshotFingerprint(snapshot);
    if (fp === lastFingerprint.current) return;
    lastFingerprint.current = fp;
    pushWatchSnapshot(snapshot);
  }, [snapshot]);

  // Apply inbound actions through existing write paths, with id dedup + stale-day drop.
  useEffect(() => {
    return addWatchActionListener(async (action) => {
      const processed = await loadProcessedIds();
      if (!shouldApplyWatchAction(action, processed)) return;
      await rememberProcessedId(action.id);

      switch (action.type) {
        case 'logWater':
          await logWater(action.amountMl);
          break;
        case 'startWorkout': {
          // Relay to the iPhone burn Live Activity (same path as the home screen).
          const entry = getCatalogEntryById(action.activityId);
          if (entry) {
            await startLiveWorkout(
              catalogEntryToBurnActivity(entry),
              action.calorieGoal ?? DEFAULT_BURN_GOAL_CAL,
            );
          }
          break;
        }
        case 'pauseWorkout':
          await pauseLiveWorkout();
          break;
        case 'resumeWorkout':
          await resumeLiveWorkout();
          break;
        case 'endWorkout':
          await endLiveWorkout();
          break;
        case 'logWorkout':
          // TODO(watch): retroactive quick-log via useWorkouts.logWorkout.
          break;
      }
    });
  }, [logWater, startLiveWorkout, endLiveWorkout, pauseLiveWorkout, resumeLiveWorkout]);
}
