import type {
  Confidence,
  CoachingFocus,
  DailyCoachingDecision,
  DailyCoachingInput,
  Directive,
  IllnessSignals,
  NutritionGap,
} from '@/types/daily-coaching';
import type { ReadinessRecommendation } from '@/types/readiness';
import { rankNutritionGaps } from '@/utils/nutrition-gap-ranker';
import { coachingDuration } from '@/utils/coaching-duration';

// ── Small helpers ────────────────────────────────────────────────────────────

const DIRECTIVE_RANK: Record<Directive, number> = { rest: 0, light: 1, moderate: 2, train_hard: 3 };

function mapRecommendation(rec: ReadinessRecommendation | null): Directive | null {
  switch (rec) {
    case 'Rest':          return 'rest';
    case 'Light workout': return 'light';
    case 'Moderate':      return 'moderate';
    case 'Train hard':    return 'train_hard';
    default:              return null;
  }
}

function countIllness(s: IllnessSignals): number {
  return (s.resting_hr_elevated ? 1 : 0) + (s.hrv_suppressed ? 1 : 0) + (s.respiratory_rate_elevated ? 1 : 0);
}

function dayWord(n: number): string {
  return n === 1 ? 'day' : 'days';
}

function isGainGoal(goal: string): boolean {
  return /gain|muscle|bulk/i.test(goal);
}

function computeConfidence(input: DailyCoachingInput): Confidence {
  if (!input.readiness.available || input.history_days < 2) return 'minimal';
  if (input.has_baselines && input.history_days >= 5) return 'full';
  return 'partial';
}

function isColdStart(input: DailyCoachingInput): boolean {
  return input.history_days === 0 && !input.has_baselines;
}

// ── Deterministic, number-bearing string builders ───────────────────────────

function proteinAction(gap: NutritionGap): string {
  return `You're averaging ${gap.avg_consumed}g protein over ${gap.logged_days} logged ${dayWord(gap.logged_days)}, about ${gap.deficit}g under your ${gap.target}g target, so add a protein source to a meal today.`;
}

function calorieAction(gap: NutritionGap): string {
  return `You're averaging ${gap.avg_consumed} calories over ${gap.logged_days} logged ${dayWord(gap.logged_days)}, about ${gap.deficit} under your ${gap.target} target, so add a bit more to a meal today.`;
}

function gapAction(gap: NutritionGap): string {
  return gap.nutrient === 'protein' ? proteinAction(gap) : calorieAction(gap);
}

function hydrationNudge(pct: number): string {
  return `Water's been light — you're at ${pct}% of today's goal, so keep a bottle handy.`;
}

// ── Cold start ───────────────────────────────────────────────────────────────

function coldStartDecision(input: DailyCoachingInput): DailyCoachingDecision {
  const dur = coachingDuration('light', input.cycle);
  return {
    directive: 'light',
    safety_override: false,
    primary_reason:
      "Welcome — let's start easy while your coach learns your patterns. Log your meals and a check-in today so tomorrow's plan is truly yours.",
    duration_text: dur.text,
    secondary_action: null,
    habit_nudge: null,
    focus: 'training',
    dropped: [],
    confidence: 'minimal',
    nutrition_gap: null,
    assembled_at: new Date().toISOString(),
  };
}

// ── Main assembler ───────────────────────────────────────────────────────────

/**
 * Applies the priority ladder to produce ONE directive plus at most one supporting
 * action. Rules decide entirely; the LLM later only phrases this output.
 *
 * Ladder:
 *   Slot 0 — Safety. Two of three illness signals OR 3 consecutive hard days force
 *            rest. A single illness signal caps to `light` (never forces rest).
 *   Slot 1 — Training directive from readiness. Minimal confidence caps it to `light`.
 *   Slot 2 — Biggest nutrition gap (logged days only).
 *   Slot 3 — Hydration nudge, only when no nutrition gap took the action slot.
 */
export function assembleDailyCoachingDecision(input: DailyCoachingInput): DailyCoachingDecision {
  if (isColdStart(input)) return coldStartDecision(input);

  const confidence = computeConfidence(input);
  const base = mapRecommendation(input.readiness.recommendation) ?? 'light';

  const illnessCount = countIllness(input.illness);
  const forceRest = illnessCount >= 2 || input.consecutive_hard_days >= 3;
  const capLight = illnessCount === 1;

  let directive: Directive = base;
  let safety_override = false;
  let primary_reason: string;
  let focus: CoachingFocus = 'training';

  if (forceRest) {
    directive = 'rest';
    safety_override = true;
    focus = 'recovery';
    primary_reason =
      input.consecutive_hard_days >= 3
        ? `You've trained hard ${input.consecutive_hard_days} ${dayWord(input.consecutive_hard_days)} in a row, so today is a rest day to let your body rebound.`
        : `A couple of your recovery signals are off today, so take a rest day and let things settle.`;
  } else {
    let reasonKind: 'normal' | 'illness_light' | 'minimal_light' = 'normal';

    // Single illness signal → cap to light (safety-driven).
    if (capLight && DIRECTIVE_RANK[directive] > DIRECTIVE_RANK.light) {
      directive = 'light';
      safety_override = true;
      reasonKind = 'illness_light';
    } else if (capLight) {
      // base already light/rest — still note the signal.
      safety_override = true;
      reasonKind = 'illness_light';
    }

    // Minimal confidence → cannot prescribe above light.
    if (confidence === 'minimal' && DIRECTIVE_RANK[directive] > DIRECTIVE_RANK.light) {
      directive = 'light';
      if (reasonKind === 'normal') reasonKind = 'minimal_light';
    } else if (confidence === 'minimal' && reasonKind === 'normal' && directive !== 'rest') {
      reasonKind = 'minimal_light';
    }

    const dur = coachingDuration(directive, input.cycle);
    primary_reason = buildDirectiveReason(directive, reasonKind, dur.text);
    if (directive === 'rest') focus = 'recovery';
  }

  const dur = coachingDuration(directive, input.cycle);
  const duration_text = dur.text;

  // ── Nutrition gap (Slot 2) ──────────────────────────────────────────────
  const ranked = rankNutritionGaps(input.nutrition_days, input.nutrition_targets);
  const eligible = ranked.filter(
    (g) => g.nutrient === 'protein' || (g.nutrient === 'calories' && isGainGoal(input.goal)),
  );
  const topGap = eligible[0] ?? null;

  // ── Hydration (Slot 3) ──────────────────────────────────────────────────
  const h = input.hydration;
  const hydrationPct =
    h.active && h.logged_ml != null && h.target_ml != null && h.target_ml > 0
      ? Math.round((h.logged_ml / h.target_ml) * 100)
      : null;
  const hydrationLow = hydrationPct != null && hydrationPct < 70;

  let secondary_action: string | null = null;
  let habit_nudge: string | null = null;
  let nutrition_gap: NutritionGap | null = null;
  const dropped: string[] = [];

  if (forceRest) {
    // Safety wins alone — hold supporting actions, record them as dropped.
    if (topGap) dropped.push(gapAction(topGap));
    if (hydrationLow) dropped.push(hydrationNudge(hydrationPct!));
  } else {
    if (topGap) {
      secondary_action = gapAction(topGap);
      nutrition_gap = topGap;
      // Nutrition takes the single action slot; hydration steps aside.
      if (hydrationLow) dropped.push(hydrationNudge(hydrationPct!));
    } else if (hydrationLow) {
      habit_nudge = hydrationNudge(hydrationPct!);
    }
  }

  return {
    directive,
    safety_override,
    primary_reason,
    duration_text,
    secondary_action,
    habit_nudge,
    focus,
    dropped,
    confidence,
    nutrition_gap,
    assembled_at: new Date().toISOString(),
  };
}

// ── Directive sentence builder (Slot 1 wording) ─────────────────────────────

function buildDirectiveReason(
  directive: Directive,
  kind: 'normal' | 'illness_light' | 'minimal_light',
  duration: string | null,
): string {
  if (kind === 'minimal_light') {
    return "Not enough signal yet to call it, so go by feel and keep today easy.";
  }
  if (kind === 'illness_light') {
    return duration
      ? `One of your recovery signals is running high, so keep today light — an easy ${duration} is plenty.`
      : `One of your recovery signals is running high, so keep today light and gentle.`;
  }

  switch (directive) {
    case 'rest':
      return 'Your readiness is low today, so rest and let your body recover.';
    case 'light':
      return duration
        ? `Your readiness is a little down, so keep it light today with an easy ${duration}.`
        : 'Your readiness is a little down, so keep it light and easy today.';
    case 'moderate':
      return `You're in a solid spot today, good for a moderate session of about ${duration}.`;
    case 'train_hard':
      return `You're primed today, so make it count with a hard ${duration} session.`;
  }
}
