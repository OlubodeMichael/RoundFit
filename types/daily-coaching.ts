import type { CyclePhase } from '@/context/cycle-context';
import type { ReadinessRecommendation, ReadinessPillarId } from '@/types/readiness';

// ── The coaching directive & confidence ─────────────────────────────────────

/** The single training directive for the day. Drives the mascot state. */
export type Directive = 'rest' | 'light' | 'moderate' | 'train_hard';

/**
 * How much the underlying data supports a confident prescription.
 * `minimal` reshapes the message into "go by feel", never a confident directive.
 */
export type Confidence = 'full' | 'partial' | 'minimal';

/** What the day's coaching is primarily about (drives the card icon). */
export type CoachingFocus = 'training' | 'nutrition' | 'hydration' | 'sleep' | 'recovery';

// ── Engine input (assembled by the Phase-2 hook from existing contexts) ──────

/** One day of nutrition, with an explicit logged flag — unlogged days are ignored. */
export interface NutritionDay {
  date: string;
  /** True only when the user actually logged food that day. */
  logged: boolean;
  calories_consumed: number | null;
  protein_consumed: number | null;
}

export interface NutritionTargets {
  calorie_budget: number | null;
  protein_target: number | null;
}

/** Illness-proxy signals. Two of three are required to force rest (§Slot 0). */
export interface IllnessSignals {
  /** Resting HR elevated vs baseline. */
  resting_hr_elevated: boolean;
  /** HRV suppressed > 20% below baseline. */
  hrv_suppressed: boolean;
  /** Respiratory rate elevated vs baseline. */
  respiratory_rate_elevated: boolean;
}

export interface DailyCoachingInput {
  /** Local date (YYYY-MM-DD) the decision is for. */
  date: string;

  /** Training readiness (from computeReadiness). `available: false` at cold start. */
  readiness: {
    available: boolean;
    score: number | null;
    recommendation: ReadinessRecommendation | null;
    limiting_pillar: ReadinessPillarId | null;
    reason: string | null;
  };

  /** Consecutive hard-training days ending yesterday. 3+ forces rest. */
  consecutive_hard_days: number;

  /** Illness-proxy signals for the safety slot. */
  illness: IllnessSignals;

  /** Nutrition goal, drives whether a calorie shortfall counts as a gap. */
  goal: string;

  /** Last few days of nutrition (with logged flags) for the gap ranker. */
  nutrition_days: NutritionDay[];
  nutrition_targets: NutritionTargets;

  /** Cycle context, used for the late-luteal duration cap. */
  cycle: {
    include: boolean;
    phase: CyclePhase;
    days_remaining: number | null;
  };

  /** Today's hydration, for the habit nudge. */
  hydration: {
    /** Whether the hydration pillar is active/tracked. */
    active: boolean;
    logged_ml: number | null;
    target_ml: number | null;
  };

  /** Whether HRV/RHR baselines exist yet (affects confidence & cold start). */
  has_baselines: boolean;
  /** Days of usable history (affects confidence & cold start). */
  history_days: number;
}

// ── Engine output ───────────────────────────────────────────────────────────

/** A ranked nutrition shortfall. Every number here is derived from logged days only. */
export interface NutritionGap {
  nutrient: 'protein' | 'calories';
  /** Average over LOGGED days only. */
  avg_consumed: number;
  target: number;
  /** target − avg_consumed (always > 0 for a gap). */
  deficit: number;
  /** Count of LOGGED days under target (never exceeds logged_days). */
  days_under: number;
  /** Number of days actually logged in the window. */
  logged_days: number;
  gap_score: number;
}

/**
 * The finished decision. The LLM only PHRASES this — it invents nothing.
 * Every number in any rendered message must trace to a field here.
 */
export interface DailyCoachingDecision {
  directive: Directive;
  /** True when a safety rule replaced/capped the readiness directive. */
  safety_override: boolean;
  /** The directive sentence, number-bearing and deterministic. */
  primary_reason: string;
  /** Duration guidance for training directives, or null (e.g. rest). */
  duration_text: string | null;
  /** The single nutrition-gap action, or null. */
  secondary_action: string | null;
  /** A hydration/sleep habit nudge, or null. Suppressed when a nutrition gap wins. */
  habit_nudge: string | null;
  /** Primary theme, drives the card icon. */
  focus: CoachingFocus;
  /** Actions considered but dropped (by safety or the single-action cap). */
  dropped: string[];
  confidence: Confidence;
  /** Structured nutrition gap behind `secondary_action` (for the "why" affordance). */
  nutrition_gap: NutritionGap | null;
  /** ISO timestamp the decision was assembled. */
  assembled_at: string;
}
