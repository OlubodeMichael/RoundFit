import { useCallback, useEffect, useState } from 'react';

import type { DailyCoachingDecision } from '@/types/daily-coaching';
import { coachingDecisionFingerprint } from '@/utils/coaching-cache';
import {
  getOpenedRecord,
  setOpenedRecord,
  visibleBadgeCount,
  type CoachingOpenedRecord,
} from '@/utils/coaching-badge';
import { getLocalDateString } from '@/utils/date';

export interface UseCoachingBadgeResult {
  /** Honest count to render on the mascot — 0 once this decision has been opened. */
  count: number;
  /** Call when the user opens the card; clears the badge for this exact decision. */
  markOpened: () => void;
}

/**
 * Drives the honest mascot badge. Reads the persisted "last opened" record and, for
 * today's decision, shows how many distinct fresh events remain unacknowledged.
 * A new decision (new fingerprint) re-badges; yesterday's unread simply never surfaces
 * because the decision passed in is always today's.
 */
export function useCoachingBadge(
  decision: DailyCoachingDecision | null,
): UseCoachingBadgeResult {
  const [opened, setOpened] = useState<CoachingOpenedRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const record = await getOpenedRecord();
      if (!cancelled) setOpened(record);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fingerprint = decision ? coachingDecisionFingerprint(decision) : null;

  const markOpened = useCallback(() => {
    if (!decision || !fingerprint) return;
    const record: CoachingOpenedRecord = {
      date: getLocalDateString(),
      fingerprint,
    };
    setOpened(record);
    void setOpenedRecord(record);
  }, [decision, fingerprint]);

  const count =
    decision && fingerprint ? visibleBadgeCount(decision, fingerprint, opened) : 0;

  return { count, markOpened };
}
