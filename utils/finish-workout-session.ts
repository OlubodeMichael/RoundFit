import { getBackendTypeForCatalogId, getCatalogEntryById } from '@/config/workout-catalog';
import type { HealthData } from '@/context/health-context';
import type { LogSetInput, LogWorkoutInput, Workout } from '@/context/workout-context';
import { resolveSessionMetricsDelta } from '@/hooks/use-session-metrics';
import type { SessionRecapData } from '@/types/session-recap';
import type { SessionSet, WorkoutSession } from '@/types/workout-session';
import { toLocalOffsetIso } from '@/utils/date';
import { computeSessionScores } from '@/utils/session-scores';
import { DEFAULT_SESSION_WEIGHT_KG } from '@/utils/session-metrics';
import type { PostHog } from 'posthog-react-native';

/** Minimal session snapshot after Live Activity ends — used for persistence. */
export interface CompletedWorkoutSnapshot {
  workoutType: string;
  workoutName: string;
  startedAt: number;
  sets: SessionSet[];
}

export interface FinishAndSaveWorkoutSessionParams {
  /** Full session from context (metrics baseline, calorie goal, sets). */
  session: WorkoutSession;
  completed: CompletedWorkoutSnapshot;
  logWorkout: (input: LogWorkoutInput) => Promise<Workout>;
  logSets?: (workoutId: string, sets: LogSetInput[]) => Promise<unknown>;
  healthToday: Pick<HealthData, 'active_calories' | 'avg_heart_rate' | 'max_heart_rate'> | null | undefined;
  weightKg?: number;
  userAge?: number;
  endedAt?: number;
  posthog?: Pick<PostHog, 'capture'>;
}

export interface FinishAndSaveWorkoutSessionResult {
  workout: Workout;
  recapData: SessionRecapData;
}

export async function finishAndSaveWorkoutSession(
  params: FinishAndSaveWorkoutSessionParams,
): Promise<FinishAndSaveWorkoutSessionResult> {
  const {
    session,
    completed,
    logWorkout,
    logSets,
    healthToday,
    weightKg = DEFAULT_SESSION_WEIGHT_KG,
    userAge,
    endedAt = Date.now(),
    posthog,
  } = params;

  const durationMs = endedAt - completed.startedAt;
  const durationMins = Math.max(1, Math.round(durationMs / 60000));
  const catalogEntry = getCatalogEntryById(completed.workoutType);
  const isStrength = catalogEntry?.sessionMode === 'strength';
  const backendType = getBackendTypeForCatalogId(completed.workoutType) ?? 'other';

  const resolvedMetrics = resolveSessionMetricsDelta(session, healthToday, weightKg);

  const scores = computeSessionScores({
    mode: isStrength ? 'strength' : 'cardio',
    durationMins,
    intensity: 'moderate',
    sets: completed.sets,
    metrics: resolvedMetrics,
    calorieGoal: session.calorieGoal,
    userAge,
    healthkitBound: session.healthkitUuid != null,
  });

  const totalVolume = scores.volume_kg ?? 0;
  const startedAtIso = toLocalOffsetIso(completed.startedAt);
  const endedAtIso = toLocalOffsetIso(endedAt);

  const workout = await logWorkout({
    type: backendType,
    duration_mins: durationMins,
    intensity: 'moderate',
    source: 'manual',
    started_at: startedAtIso,
    ended_at: endedAtIso,
    ...(resolvedMetrics.caloriesBurned > 0
      ? { calories_burned: resolvedMetrics.caloriesBurned }
      : {}),
    ...(resolvedMetrics.avgHeartRate != null
      ? { avg_heart_rate: resolvedMetrics.avgHeartRate }
      : {}),
    ...(resolvedMetrics.maxHeartRate != null
      ? { max_heart_rate: resolvedMetrics.maxHeartRate }
      : {}),
    metrics: {
      strain_score: scores.strain_score,
      ...(scores.hr_zone_minutes
        ? { hr_zone_minutes: scores.hr_zone_minutes as unknown as Record<string, number> }
        : {}),
      ...(totalVolume > 0 ? { volume_kg: totalVolume } : {}),
    },
  });

  if (completed.sets.length > 0 && logSets) {
    await logSets(
      workout.id,
      completed.sets.map((s) => ({
        exercise: s.exercise,
        reps: s.reps,
        weight: s.weightKg > 0 ? s.weightKg : undefined,
        weight_unit: 'kg' as const,
      })),
    );
  }

  posthog?.capture('workout_session_ended', {
    activity_id: completed.workoutType,
    duration_mins: durationMins,
    calories_burned: resolvedMetrics.caloriesBurned,
    strain_score: scores.strain_score,
    mode: isStrength ? 'strength' : 'cardio',
    source: resolvedMetrics.source,
  });

  const recapData: SessionRecapData = {
    workoutName: completed.workoutName,
    durationMs,
    caloriesBurned: resolvedMetrics.caloriesBurned,
    caloriesSource: resolvedMetrics.source,
    avgHeartRate: resolvedMetrics.avgHeartRate,
    strainScore: scores.strain_score,
    volumeKg: totalVolume > 0 ? totalVolume : undefined,
    goalPercent: scores.goalPercent,
    isStrength,
  };

  return { workout, recapData };
}
