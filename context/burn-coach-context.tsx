import type { ComponentProps } from 'react';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePostHog } from 'posthog-react-native';

import { WorkoutLauncher } from '@/components/log/workout/WorkoutLauncher';
import { WorkoutSessionRecapSheet } from '@/components/log/workout/WorkoutSessionRecapSheet';
import { useToast } from '@/components/ui/Toast';
import {
  getBurnCatalogEntries,
  getCatalogEntryById,
  type WorkoutCatalogEntry,
} from '@/config/workout-catalog';
import { useFood } from '@/context/food-context';
import { useWorkouts } from '@/context/workout-context';
import { useWorkoutSession } from '@/context/workout-session-context';
import { useHealth } from '@/hooks/use-health';
import { useProfile } from '@/hooks/use-profile';
import {
  useWorkoutLiveActivity,
  type ActiveWorkoutState,
} from '@/hooks/use-workout-live-activity';
import type { SessionRecapData } from '@/types/session-recap';
import type { WorkoutSelection } from '@/types/workout-session';
import {
  catalogEntryToBurnActivity,
  computeDurationMinutes,
  formatCatalogPrescription,
} from '@/utils/burn-prescription';
import { finishAndSaveWorkoutSession } from '@/utils/finish-workout-session';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const DEFAULT_BURN_FRACTION = 0.15;   // recommend burning 15% of the daily goal
const MIN_CALORIES_TO_BURN = 80;
const DEFAULT_WEIGHT_KG = 70;

export interface BurnCoachActivity {
  label: string;
  icon?: IoniconName;
}

export interface BurnCoachContextValue {
  /** The active live workout, or null when idle. */
  liveWorkout: ActiveWorkoutState | null;
  /** True while any workout is running — cardio (burn) or strength (session). */
  isRecording: boolean;
  /** True when the running workout is paused, in either mode. */
  isPaused: boolean;
  /** Calories burned so far during the active workout. */
  liveBurned: number;
  /** Remaining calories to burn to hit today's goal. */
  caloriesToBurn: number;
  /** Prescribed activity to close the gap (label + icon). */
  activity: BurnCoachActivity;
  /** Progress toward today's burn goal, 0…1. */
  goalProgress: number;
  /** Opens the activity picker; selecting an activity starts recording. */
  openPicker: () => void;
  /** Ends the active workout and surfaces the recap. */
  end: () => void;
}

const BurnCoachContext = createContext<BurnCoachContextValue | null>(null);

export function BurnCoachProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const { meals, mealGoal } = useFood();
  const { today: healthToday } = useHealth();
  const { logWorkout } = useWorkouts();
  const posthog = usePostHog();
  const toast = useToast();

  const {
    session: workoutSessionSnapshot,
    start: startWorkoutSession,
    end: endWorkoutSession,
  } = useWorkoutSession();

  const {
    active: liveWorkout,
    start: startLiveWorkout,
    end: endLiveWorkout,
  } = useWorkoutLiveActivity();

  const [coachCatalogEntry, setCoachCatalogEntry] = useState<WorkoutCatalogEntry>(
    () => getCatalogEntryById('walk') ?? getBurnCatalogEntries()[0],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recapVisible, setRecapVisible] = useState(false);
  const [recapData, setRecapData] = useState<SessionRecapData | null>(null);
  const [finishing, setFinishing] = useState(false);

  const weightKg = profile?.weightKg ?? DEFAULT_WEIGHT_KG;
  const totalCalories = useMemo(
    () => meals.reduce((sum, m) => sum + m.cals, 0),
    [meals],
  );

  const liveBurned = liveWorkout
    ? Math.max(
        0,
        (healthToday?.active_calories ?? liveWorkout.baselineCals) -
          liveWorkout.baselineCals,
      )
    : 0;

  const coachData = useMemo(() => {
    const base = Math.round(mealGoal * DEFAULT_BURN_FRACTION);
    const over = Math.max(totalCalories - mealGoal, 0);
    const caloriesToBurnGoal = Math.max(base + over, MIN_CALORIES_TO_BURN);
    const activeBurned = healthToday?.active_calories ?? 0;
    const remaining = Math.max(caloriesToBurnGoal - activeBurned, 0);
    const met = coachCatalogEntry.met ?? 0;
    const minutes = computeDurationMinutes(met, weightKg, remaining);
    return {
      caloriesToBurn: remaining,
      activity: {
        label:
          minutes > 0
            ? formatCatalogPrescription(coachCatalogEntry, minutes)
            : 'Goal reached!',
        icon: coachCatalogEntry.icon,
      } satisfies BurnCoachActivity,
      goalProgress:
        caloriesToBurnGoal > 0 ? Math.min(activeBurned / caloriesToBurnGoal, 1) : 0,
    };
  }, [mealGoal, totalCalories, coachCatalogEntry, weightKg, healthToday]);

  const openPicker = useCallback(() => setPickerOpen(true), []);

  const handleLiveStart = useCallback(
    (selection: WorkoutSelection) => {
      setCoachCatalogEntry(selection.entry);
      const goal = selection.calorieGoal ?? coachData.caloriesToBurn;
      void startWorkoutSession({ ...selection, entrySurface: 'home' });

      // A strength session already gets its own Live Activity — the sets card
      // from use-workout-session-live-activity. Starting the burn card as well
      // put two activities on the lock screen for a single workout.
      if (selection.entry.sessionMode !== 'strength') {
        void startLiveWorkout(catalogEntryToBurnActivity(selection.entry), goal);
      }
    },
    [startWorkoutSession, startLiveWorkout, coachData.caloriesToBurn],
  );

  const end = useCallback(async () => {
    if (finishing) return;

    const sessionSnapshot = workoutSessionSnapshot;
    const liveSnapshot = liveWorkout;

    // Strength runs without a burn activity, so a missing `liveSnapshot` no
    // longer means "nothing is running" — bail only when there's no session
    // either, or a strength workout would never be saved or cleared.
    if (!liveSnapshot && !sessionSnapshot) {
      await endLiveWorkout();
      return;
    }

    setFinishing(true);
    try {
      await endLiveWorkout();

      if (!sessionSnapshot) {
        await endWorkoutSession();
        return;
      }

      const { recapData: recap } = await finishAndSaveWorkoutSession({
        session: sessionSnapshot,
        completed: {
          // Fall back to the session for strength, which has no burn snapshot.
          workoutType: liveSnapshot?.activity.id ?? sessionSnapshot.workoutType,
          workoutName: liveSnapshot?.activity.label ?? sessionSnapshot.workoutName,
          startedAt: liveSnapshot?.startedAt ?? sessionSnapshot.startedAt,
          // `completed.sets` is what actually gets logged — hardcoding [] would
          // silently discard every set logged during a strength session.
          sets: sessionSnapshot.sets,
        },
        logWorkout,
        healthToday,
        weightKg: profile?.weightKg,
        userAge: profile?.age,
        posthog,
      });

      setRecapData(recap);
      setRecapVisible(true);
      await endWorkoutSession();
    } catch {
      toast.error('Could not save', 'Workout ended; try logging manually.');
      await endWorkoutSession();
    } finally {
      setFinishing(false);
    }
  }, [
    finishing,
    workoutSessionSnapshot,
    liveWorkout,
    endLiveWorkout,
    endWorkoutSession,
    logWorkout,
    healthToday,
    profile?.weightKg,
    profile?.age,
    posthog,
    toast,
  ]);

  const handleRecapDone = useCallback(() => {
    setRecapVisible(false);
    setRecapData(null);
  }, []);

  const value = useMemo<BurnCoachContextValue>(
    () => ({
      liveWorkout,
      liveBurned,
      // "Is a workout running" must cover both modes: strength has a session but
      // no burn activity, so `liveWorkout` alone would leave the home record
      // button showing idle mid-workout.
      isRecording: liveWorkout != null || workoutSessionSnapshot != null,
      isPaused:
        (liveWorkout?.pausedAt ?? workoutSessionSnapshot?.pausedAt ?? null) != null,
      caloriesToBurn: coachData.caloriesToBurn,
      activity: coachData.activity,
      goalProgress: coachData.goalProgress,
      openPicker,
      end: () => void end(),
    }),
    [liveWorkout, liveBurned, workoutSessionSnapshot, coachData, openPicker, end],
  );

  return (
    <BurnCoachContext.Provider value={value}>
      {children}

      <WorkoutLauncher
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        intent="burn"
        initialCalorieGoal={coachData.caloriesToBurn}
        onLiveStart={handleLiveStart}
      />

      <WorkoutSessionRecapSheet
        visible={recapVisible}
        data={recapData}
        onDone={handleRecapDone}
      />
    </BurnCoachContext.Provider>
  );
}

export function useBurnCoach(): BurnCoachContextValue {
  const ctx = useContext(BurnCoachContext);
  if (!ctx) throw new Error('useBurnCoach must be used inside <BurnCoachProvider>');
  return ctx;
}
