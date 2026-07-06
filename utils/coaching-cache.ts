import type { DailyCoachingDecision } from '@/types/daily-coaching';
import type { CoachingMessage } from '@/utils/resolve-coaching-message';
import { buildResourceKey } from '@/utils/resource-cache';

export interface DailyCoachingCache {
  fingerprint: string;
  decision: DailyCoachingDecision;
  message: CoachingMessage;
}

/** Stable content hash — excludes `assembled_at` so identical inputs reuse phrasing. */
export function coachingDecisionFingerprint(d: DailyCoachingDecision): string {
  return JSON.stringify({
    directive: d.directive,
    safety_override: d.safety_override,
    primary_reason: d.primary_reason,
    duration_text: d.duration_text,
    secondary_action: d.secondary_action,
    habit_nudge: d.habit_nudge,
    confidence: d.confidence,
    focus: d.focus,
    dropped: d.dropped,
    nutrition_gap: d.nutrition_gap,
  });
}

export function coachingCacheKey(userId: string, date: string): string {
  return buildResourceKey('coaching', userId, date);
}
