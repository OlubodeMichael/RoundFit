import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateString } from '@/utils/date';

const KEY = 'checkin_completed_date';

/** Returns true if the user has already checked in (or skipped) today. */
export async function hasCheckedInToday(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    return stored === getLocalDateString();
  } catch {
    return false;
  }
}

/** Call after a successful submit or skip to mark today as done. */
export async function markCheckedInToday(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, getLocalDateString());
  } catch { /* best-effort */ }
}

/** Clear local check-in state (e.g. on sign-out). */
export async function clearCheckinStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch { /* best-effort */ }
}
