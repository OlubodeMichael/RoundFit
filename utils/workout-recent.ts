import AsyncStorage from '@react-native-async-storage/async-storage';

import { getCatalogEntryById, type WorkoutCatalogEntry } from '@/config/workout-catalog';

export const WORKOUT_RECENT_ACTIVITY_IDS_KEY = '@roundfit/workout_recent_activity_ids';

const MAX_RECENT_ACTIVITY_IDS = 3;

export async function recordRecentActivityId(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(WORKOUT_RECENT_ACTIVITY_IDS_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const next = [id, ...existing.filter((existingId) => existingId !== id)].slice(
      0,
      MAX_RECENT_ACTIVITY_IDS,
    );
    await AsyncStorage.setItem(WORKOUT_RECENT_ACTIVITY_IDS_KEY, JSON.stringify(next));
  } catch {
    // Best-effort local cache — ignore storage failures.
  }
}

export async function getRecentActivityIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(WORKOUT_RECENT_ACTIVITY_IDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export async function getRecentCatalogEntries(): Promise<WorkoutCatalogEntry[]> {
  const ids = await getRecentActivityIds();
  return ids
    .map((id) => getCatalogEntryById(id))
    .filter((entry): entry is WorkoutCatalogEntry => entry != null);
}
