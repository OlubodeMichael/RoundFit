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
  /** ms since epoch — sets effective start (shifted forward on resume). */
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

interface NativeModule {
  isSupported():   boolean;
  hasActiveActivity(): boolean;
  getCurrentState(): CurrentActivityState | null;
  startActivity(params: StartActivityParams):  Promise<{ activityId: string }>;
  updateActivity(params: UpdateActivityParams): Promise<void>;
  endActivity(params: EndActivityParams):       Promise<void>;
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
    console.warn('[LiveActivity] native module is null — not linked into the build');
    return false;
  }
  const supported = Native.isSupported();
  console.log('[LiveActivity] Native.isSupported() =', supported);
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
