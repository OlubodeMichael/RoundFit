import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { hasActiveUserSession, useAuth } from '@/context/auth-context';
import { useWorkouts } from '@/hooks/use-workouts';
import {
  fetchAppleFitnessWorkoutsForDisplay,
  runWorkoutImport,
  type WorkoutImportReviewItem,
} from '@/services/workout-import';
import {
  enableWorkoutBackgroundDelivery,
  subscribeToWorkoutUpdates,
} from '@/utils/healthkit';

const FOREGROUND_POLL_MS = 45_000;

export interface UseHealthKitWorkoutImportOptions {
  /** When true, new workouts are queued for review instead of auto-imported. */
  reviewBeforeImport?: boolean;
  /** Called after sync when pending review items are found. */
  onPendingReviews?: (items: WorkoutImportReviewItem[]) => void;
}

export interface UseHealthKitWorkoutImportResult {
  lastImportAt: Date | null;
  isImporting:  boolean;
  error:        string | null;
  /** Manual trigger — also runs automatically on AppState → active and every 45s while foregrounded. */
  runImport:    () => Promise<void>;
}

export function useHealthKitWorkoutImport(
  options: UseHealthKitWorkoutImportOptions = {},
): UseHealthKitWorkoutImportResult {
  const { reviewBeforeImport = false, onPendingReviews } = options;
  const { status, user } = useAuth();
  const { logWorkout, workouts } = useWorkouts();

  const [lastImportAt, setLastImportAt] = useState<Date | null>(null);
  const [isImporting, setIsImporting]   = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const inFlightRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const onPendingReviewsRef = useRef(onPendingReviews);
  onPendingReviewsRef.current = onPendingReviews;
  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;

  const runImport = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    if (!hasActiveUserSession(status, user)) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setIsImporting(true);
    setError(null);

    try {
      const knownUuids = new Set(
        workoutsRef.current
          .map((workout) => workout.healthkit_uuid)
          .filter((uuid): uuid is string => typeof uuid === 'string' && uuid.length > 0),
      );

      const isAlreadyImported = (uuid: string) => knownUuids.has(uuid);

      const userId = user!.id;

      if (reviewBeforeImport) {
        const pending = await fetchAppleFitnessWorkoutsForDisplay({
          isAlreadyImported,
          userId,
        });
        onPendingReviewsRef.current?.(pending);
      } else {
        await runWorkoutImport(logWorkout, { isAlreadyImported, userId });
      }

      setLastImportAt(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'HealthKit workout import failed');
    } finally {
      inFlightRef.current = false;
      setIsImporting(false);
    }
  }, [logWorkout, reviewBeforeImport, status, user]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!hasActiveUserSession(status, user)) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (!prevState.match(/inactive|background/) || nextState !== 'active') return;
      void runImport();
    });

    void runImport();

    return () => subscription.remove();
  }, [runImport, status, user]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!hasActiveUserSession(status, user)) return;

    const interval = setInterval(() => {
      if (appStateRef.current !== 'active') return;
      void runImport();
    }, FOREGROUND_POLL_MS);

    return () => clearInterval(interval);
  }, [runImport, status, user]);

  // Best-effort HKWorkout observer + background delivery (Phase D).
  // Requires native UIBackgroundModes healthkit; silently no-ops when unavailable.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (!hasActiveUserSession(status, user)) return;

    void enableWorkoutBackgroundDelivery().catch(() => {});

    const subscription = subscribeToWorkoutUpdates(() => {
      void runImport();
    });

    return () => {
      subscription?.remove();
    };
  }, [runImport, status, user]);

  return {
    lastImportAt,
    isImporting,
    error,
    runImport,
  };
}
