import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DailyCoachingDecision } from '@/types/daily-coaching';

const OPENED_KEY = 'coaching:badge:opened';

/** What the user last acknowledged — one decision, identified by day + fingerprint. */
export interface CoachingOpenedRecord {
  date: string;
  fingerprint: string;
}

/**
 * Honest badge count for a decision: the number of DISTINCT fresh coaching events
 * it carries, never padded.
 *
 *   1  the directive itself (always present)
 *   +1 a nutrition-gap action     (secondary_action)
 *   +1 a hydration/sleep nudge    (habit_nudge)
 *
 * Capped at 3. There is no "you have unread coaching" inflation — every point maps
 * to a concrete thing the card will actually say.
 */
export function coachingBadgeCount(decision: DailyCoachingDecision): number {
  const events =
    1 +
    (decision.secondary_action ? 1 : 0) +
    (decision.habit_nudge ? 1 : 0);
  return Math.min(events, 3);
}

/**
 * The count to actually render on the mascot: the honest count, or 0 once the user
 * has opened THIS exact decision. A genuinely new decision (new fingerprint, e.g. a
 * nutrition gap appearing later in the day) re-badges; reopening the same one does not.
 */
export function visibleBadgeCount(
  decision: DailyCoachingDecision,
  fingerprint: string,
  opened: CoachingOpenedRecord | null,
): number {
  if (opened && opened.fingerprint === fingerprint) return 0;
  return coachingBadgeCount(decision);
}

export async function getOpenedRecord(): Promise<CoachingOpenedRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(OPENED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CoachingOpenedRecord;
    if (typeof parsed?.date === 'string' && typeof parsed?.fingerprint === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setOpenedRecord(record: CoachingOpenedRecord): Promise<void> {
  try {
    await AsyncStorage.setItem(OPENED_KEY, JSON.stringify(record));
  } catch {
    // best-effort; a lost write just means the badge shows once more
  }
}
