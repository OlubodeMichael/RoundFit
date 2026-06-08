import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateString } from '@/utils/date';

function storageKey(userId: string): string {
  return `checkin_completed_date:${userId}`;
}

/** Returns true if the user has already logged today's check-in. */
export async function hasCheckedInToday(userId: string): Promise<boolean> {
  try {
    const today = getLocalDateString();
    const key   = storageKey(userId);
    let stored  = await AsyncStorage.getItem(key);

    if (!stored) {
      const legacy = await AsyncStorage.getItem('checkin_completed_date');
      if (legacy === today) {
        await AsyncStorage.setItem(key, today);
        await AsyncStorage.removeItem('checkin_completed_date');
        return true;
      }
    }

    return stored === today;
  } catch {
    return false;
  }
}

/** Call after a successful submit or skip to lock today as done. */
export async function markCheckedInToday(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), getLocalDateString());
  } catch { /* best-effort */ }
}

/** Clear local check-in state (e.g. on sign-out). */
export async function clearCheckinStorage(userId?: string): Promise<void> {
  try {
    if (userId) {
      await AsyncStorage.removeItem(storageKey(userId));
      return;
    }
    const allKeys = await AsyncStorage.getAllKeys();
    const matching = allKeys.filter((k) => k.startsWith('checkin_completed_date:'));
    if (matching.length > 0) {
      await AsyncStorage.multiRemove(matching);
    }
  } catch { /* best-effort */ }
}
