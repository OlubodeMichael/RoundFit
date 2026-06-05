import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface StartActivityParams {
  workoutType:  string;
  workoutName:  string;
  workoutIcon:  string;  // SF Symbol name
  goalCalories: number;
  startTime:    number;  // ms since epoch
}

export interface UpdateActivityParams {
  caloriesBurned?: number;
  heartRate?:      number;
  isActive?:       boolean;
  /** ms since epoch. Sets the effective start (shifted forward on resume). */
  startTime?:      number;
  /** ms since epoch when paused, or null to clear paused state. Omit to leave unchanged. */
  pausedAt?:       number | null;
}

export interface EndActivityParams {
  caloriesBurned: number;
  heartRate?:     number;
}

export interface CurrentActivityState {
  caloriesBurned: number;
  heartRate?:     number;
  isActive:       boolean;
  pausedAt?:      number; // ms since epoch
}

// ── Workout session (set tracker) types ──────────────────────────────────

export interface StartSessionActivityParams {
  workoutType: string;
  workoutName: string;
  workoutIcon: string; // SF Symbol name (e.g. "dumbbell.fill")
  startTime:   number; // ms since epoch
}

export interface UpdateSessionActivityParams {
  setCount?:        number;
  /** Pass to update the "last set" summary on the lock screen. */
  lastExercise?:    string | null;
  lastSetReps?:     number | null;
  lastSetWeightKg?: number | null;
  totalVolumeKg?:   number;
  /** Session-scoped burn when HealthKit / metrics engine provides it. */
  caloriesBurned?:  number;
  heartRate?:       number;
  isActive?:        boolean;
  /** ms since epoch. Effective start, shifts forward on resume. */
  startTime?:       number;
  /** ms since epoch when paused, or null to clear. Omit to leave unchanged. */
  pausedAt?:        number | null;
}

export interface EndSessionActivityParams {
  setCount?:      number;
  totalVolumeKg?: number;
}

export interface CurrentSessionActivityState {
  setCount:         number;
  lastExercise?:    string;
  lastSetReps?:     number;
  lastSetWeightKg?: number;
  totalVolumeKg:    number;
  isActive:         boolean;
  pausedAt?:        number; // ms since epoch
  startTime?:       number; // ms since epoch
}

interface NativeModule {
  isSupported():   boolean;
  hasActiveActivity(): boolean;
  getCurrentState(): CurrentActivityState | null;
  startActivity(params: StartActivityParams):  Promise<{ activityId: string }>;
  updateActivity(params: UpdateActivityParams): Promise<void>;
  endActivity(params: EndActivityParams):       Promise<void>;
  // Workout-session (set tracker): parallel API for the second activity type.
  hasActiveSessionActivity?():  boolean;
  getCurrentSessionState?():    CurrentSessionActivityState | null;
  startSessionActivity?(params: StartSessionActivityParams):   Promise<{ activityId: string }>;
  updateSessionActivity?(params: UpdateSessionActivityParams): Promise<void>;
  endSessionActivity?(params: EndSessionActivityParams):       Promise<void>;
}

const Native =
  Platform.OS === 'ios'
    ? (requireOptionalNativeModule('WorkoutLiveActivity') as NativeModule | null)
    : null;

if (Platform.OS === 'ios') {
  console.log('[LiveActivity] native module loaded?', Native != null);
}

/** True if the device supports Live Activities (iOS 16.1+ and user hasn't disabled them). */
export function isLiveActivitySupported(): boolean {
  if (!Native) {
    return false;
  }
  const supported = Native.isSupported();
  
  return supported;
}

/** True if a workout activity is currently active. */
export function hasActiveLiveActivity(): boolean {
  // Optional-chain the call itself in case the simulator has a stale native
  // binary that predates this function being added.
  return Native?.hasActiveActivity?.() ?? false;
}

/** Snapshot of the current activity's state, or null if none. */
export function getCurrentLiveActivityState(): CurrentActivityState | null {
  return Native?.getCurrentState?.() ?? null;
}

/** Start a new workout Live Activity. Rejects on iOS < 16.1 or if disabled. */
export async function startLiveActivity(
  params: StartActivityParams,
): Promise<string | null> {
  if (!Native) return null;
  const result = await Native.startActivity(params);
  return result.activityId ?? null;
}

/** Push updated calorie / heart-rate state to the active activity. */
export async function updateLiveActivity(
  params: UpdateActivityParams,
): Promise<void> {
  if (!Native) return;
  await Native.updateActivity(params);
}

/** End the active activity and show a 5-minute summary. */
export async function endLiveActivity(
  params: EndActivityParams,
): Promise<void> {
  if (!Native) return;
  await Native.endActivity(params);
}

// ── Workout session (set tracker) bindings ───────────────────────────────

/**
 * Tri-state check for the workout-session activity:
 *   - `true`  → session is active
 *   - `false` → native supports the check and there's no active session
 *   - `null`  → native module is null or this function isn't compiled in yet
 *              (e.g. simulator is running a stale binary). Callers should
 *              treat `null` as "unknown" and NOT drop their JS state.
 */
export function hasActiveSessionLiveActivity(): boolean | null {
  if (!Native || typeof Native.hasActiveSessionActivity !== 'function') {
    return null;
  }
  return Native.hasActiveSessionActivity();
}

/** Snapshot of the current workout-session activity's state, or null. */
export function getCurrentSessionLiveActivityState(): CurrentSessionActivityState | null {
  return Native?.getCurrentSessionState?.() ?? null;
}

/** Start a workout-session Live Activity (set tracker). */
export async function startSessionLiveActivity(
  params: StartSessionActivityParams,
): Promise<string | null> {
  if (!Native?.startSessionActivity) return null;
  const result = await Native.startSessionActivity(params);
  return result.activityId ?? null;
}

/** Push updated set count / last set / volume to the active session. */
export async function updateSessionLiveActivity(
  params: UpdateSessionActivityParams,
): Promise<void> {
  if (!Native?.updateSessionActivity) return;
  await Native.updateSessionActivity(params);
}

/**
 * End every workout-session Live Activity on the lock screen (immediate dismiss).
 * Safe to call before starting a new session — clears orphaned cards when the
 * in-process native reference was lost.
 */
export async function dismissAllSessionLiveActivities(): Promise<void> {
  return endSessionLiveActivity();
}

/** End the active workout session and dismiss the Live Activity. */
export async function endSessionLiveActivity(
  params: EndSessionActivityParams = {},
): Promise<void> {
  if (!Native?.endSessionActivity) return;
  await Native.endSessionActivity(params);
}
