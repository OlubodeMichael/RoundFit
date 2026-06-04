import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import type { WorkoutIntensity } from '@/context/workout-context';

export type { WorkoutCatalogEntry };

/** Cardio burn / Home LA vs strength gym session. */
export type WorkoutSessionMode = 'cardio' | 'strength';

/** Lifecycle of the in-app session engine (not the Live Activity widget). */
export type WorkoutSessionStatus = 'idle' | 'active' | 'paused' | 'completing';

export type WorkoutLauncherIntent = 'live' | 'log' | 'burn';

export type WorkoutEntrySurface = 'log' | 'home' | 'deep_link';

/** Launcher output passed into `WorkoutSessionContext.start()`. */
export interface WorkoutSelection {
  entry: WorkoutCatalogEntry;
  intent: WorkoutLauncherIntent;
  /** Where the user opened the launcher / started the session. */
  entrySurface?: WorkoutEntrySurface;
  calorieGoal?: number;
  presetExercises?: string[];
  /** Log-past intent only — filled in configure step. */
  durationMins?: number;
  intensity?: WorkoutIntensity;
  notes?: string;
}

/** One logged set during a strength session. */
export interface SessionSet {
  id: string;
  exercise: string;
  reps: number;
  /** Weight in kilograms. Use 0 for bodyweight moves. */
  weightKg: number;
  /** Local ms timestamp when the set was logged. */
  loggedAt: number;
}

/** In-memory (and optionally persisted) active workout record. */
export interface WorkoutSession {
  id: string;
  mode: WorkoutSessionMode;
  /** UI catalogue id — mapped to backend `WorkoutType` on save. */
  workoutType: string;
  workoutName: string;
  startedAt: number;
  pausedAt: number | null;
  baselineActiveCalories: number;
  healthkitUuid: string | null;
  sets: SessionSet[];
  calorieGoal?: number;
  presetExercises?: string[];
}

/** Combined session engine state exposed by the context. */
export interface WorkoutSessionState {
  status: WorkoutSessionStatus;
  session: WorkoutSession | null;
}
