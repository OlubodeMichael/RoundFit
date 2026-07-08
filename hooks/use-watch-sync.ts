import { useEffect, useMemo, useRef } from 'react';

import { getBurnCatalogEntries } from '@/config/workout-catalog';
import { useDailyCoaching } from '@/hooks/use-daily-coaching';
import { useFood } from '@/context/food-context';
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
  const { display } = useRecovery();
  const { decision } = useDailyCoaching();
  const { mealGoal, totalCalories, totalProtein } = useFood();
  const { daily } = useSummary();
  const { totalMl, goalMl, logWater } = useWater();
  const { active } = useWorkoutLiveActivity();

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
        caloriesRemaining: mealGoal - totalCalories,
        calorieGoal: mealGoal,
        proteinRemaining: proteinGoal - totalProtein,
        proteinGoal,
        waterCurrentMl: totalMl,
        waterGoalMl: goalMl,
        cupMl: WATER_CUP_ML,
        workout,
        quickPicks,
      }),
    [
      display.score,
      decision?.directive,
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
        case 'startWorkout':
        case 'endWorkout':
        case 'logWorkout':
          // TODO(watch Phase 2): relay to the iPhone burn Live Activity
          // (handleBurnLiveStart / handleBurnEnd) and useWorkouts.logWorkout.
          break;
      }
    });
  }, [logWater]);
}
