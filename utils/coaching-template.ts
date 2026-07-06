import type { DailyCoachingDecision, Directive } from '@/types/daily-coaching';

const DIRECTIVE_TITLE: Record<Directive, string> = {
  rest: 'Rest day',
  light: 'Keep it light',
  moderate: 'Moderate day',
  train_hard: 'Train hard',
};

/** Deterministic card title for a decision. Never depends on the LLM. */
export function coachingTitle(decision: DailyCoachingDecision): string {
  if (decision.safety_override && decision.directive === 'rest') return 'Rest and recover';
  return DIRECTIVE_TITLE[decision.directive];
}

/**
 * Deterministic message renderer — the always-available fallback. Covers EVERY
 * field combination: directive alone (safety override with nothing else), directive
 * + nutrition, directive + habit, or all three. Reads every number straight from the
 * decision, so it invents nothing.
 *
 * The directive sentence always comes first. Supporting sentences follow only when
 * their fields are populated.
 */
export function renderCoachingTemplate(decision: DailyCoachingDecision): string {
  const parts: string[] = [decision.primary_reason];

  if (decision.secondary_action) parts.push(decision.secondary_action);
  if (decision.habit_nudge) parts.push(decision.habit_nudge);

  return parts
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}
