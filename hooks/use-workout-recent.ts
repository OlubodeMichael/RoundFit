import { useCallback } from 'react';

import type { WorkoutSelection } from '@/types/workout-session';
import { recordRecentActivityId } from '@/utils/workout-recent';

/**
 * Persists the last few confirmed workout activity ids for the launcher recent row.
 *
 * Call `recordRecentFromSelection` after the user confirms in WorkoutLauncher
 * (live start, burn start, or log save) — not on browse-step taps alone.
 */
export function useWorkoutRecent() {
  const recordRecentFromSelection = useCallback((selection: WorkoutSelection) => {
    void recordRecentActivityId(selection.entry.id);
  }, []);

  return { recordRecentFromSelection };
}
