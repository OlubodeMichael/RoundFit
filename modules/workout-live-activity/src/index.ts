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
  caloriesBurned: number;
  heartRate?:     number;
  isActive?:      boolean;
}

export interface EndActivityParams {
  caloriesBurned: number;
  heartRate?:     number;
}

interface NativeModule {
  isSupported():   boolean;
  hasActiveActivity(): boolean;
  startActivity(params: StartActivityParams):  Promise<{ activityId: string }>;
  updateActivity(params: UpdateActivityParams): Promise<void>;
  endActivity(params: EndActivityParams):       Promise<void>;
}

const Native =
  Platform.OS === 'ios'
    ? (requireOptionalNativeModule('WorkoutLiveActivity') as NativeModule | null)
    : null;

/** True if the device supports Live Activities (iOS 16.1+ and user hasn't disabled them). */
export function isLiveActivitySupported(): boolean {
  return Native?.isSupported() ?? false;
}

/** True if a workout activity is currently active. */
export function hasActiveLiveActivity(): boolean {
  return Native?.hasActiveActivity() ?? false;
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
