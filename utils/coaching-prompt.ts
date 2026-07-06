import type { DailyCoachingDecision } from '@/types/daily-coaching';

/**
 * Serializes a finished decision into the labelled input the phrasing LLM (Apple FM
 * or OpenAI) rephrases. This is the ONLY thing the model sees — never raw user data.
 *
 * Every number the model can use already lives in `primary_reason` / `secondary_action`
 * / `habit_nudge`, so the model has nothing to invent. Pairs with the backend's
 * `DAILY_COACHING_PHRASING_PROMPT`. Keep the label vocabulary in sync with that prompt.
 */
export function buildPhrasingPrompt(decision: DailyCoachingDecision): string {
  const lines: string[] = [];

  lines.push(`Directive: ${decision.directive}${decision.safety_override ? ' (safety override)' : ''}`);
  lines.push(`Confidence: ${decision.confidence}`);
  lines.push(`Say this first: ${decision.primary_reason}`);

  if (decision.secondary_action) lines.push(`Also cover: ${decision.secondary_action}`);
  if (decision.habit_nudge) lines.push(`Also cover: ${decision.habit_nudge}`);

  return lines.join('\n');
}
