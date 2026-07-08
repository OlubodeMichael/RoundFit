import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WatchAction } from '@/types/watch';
import { getLocalDateString } from '@/utils/date';

const PROCESSED_KEY = 'watch:processed-action-ids';
const MAX_IDS = 200;

/**
 * A `WatchAction` should be applied only if it is BOTH fresh (not already processed)
 * and for today (a queued tap delivered a day late must not land on today's totals).
 * Pure — the caller owns persistence via {@link loadProcessedIds}/{@link rememberProcessedId}.
 */
export function shouldApplyWatchAction(
  action: WatchAction,
  processedIds: readonly string[],
  today: string = getLocalDateString(),
): boolean {
  if (processedIds.includes(action.id)) return false;
  return watchActionLocalDay(action) === today;
}

/** Local YYYY-MM-DD the action was taken, from its ISO `ts`. */
export function watchActionLocalDay(action: WatchAction): string {
  const d = new Date(action.ts);
  if (Number.isNaN(d.getTime())) return '';
  return getLocalDateString(d);
}

/**
 * Appends an id and returns the capped, most-recent-last window. Pure so the retention
 * behaviour is unit-testable without touching storage.
 */
export function appendProcessedId(
  processedIds: readonly string[],
  id: string,
  max: number = MAX_IDS,
): string[] {
  const next = [...processedIds.filter((x) => x !== id), id];
  return next.length > max ? next.slice(next.length - max) : next;
}

export async function loadProcessedIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function rememberProcessedId(id: string): Promise<void> {
  try {
    const current = await loadProcessedIds();
    await AsyncStorage.setItem(
      PROCESSED_KEY,
      JSON.stringify(appendProcessedId(current, id)),
    );
  } catch {
    // best-effort; a lost write can only cause an at-most-once replay, not data loss
  }
}
