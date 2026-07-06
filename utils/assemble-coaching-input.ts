import type { ComputedReadiness, ReadinessPillarId } from '@/types/readiness';
import type { CyclePhase } from '@/context/cycle-context';
import type { DailyCoachingInput, IllnessSignals, NutritionDay } from '@/types/daily-coaching';

// Illness-proxy thresholds (vs personal baseline).
const RHR_ELEVATED_RATIO = 1.05; // resting HR ≥ 5% above baseline
const HRV_SUPPRESSED_RATIO = 0.8; // HRV ≥ 20% below baseline
const RESP_ELEVATED_RATIO = 1.05; // respiratory rate ≥ 5% above baseline (not tracked yet)

export interface CoachingInputSources {
  date: string;
  /** In-app readiness (recovery-context `computed`). Null → cold start / no signal. */
  computed: ComputedReadiness | null;

  // Autonomic signals for the illness proxy (today vs baseline).
  todayRestingHr: number | null;
  todayHrv: number | null;
  restingHrBaseline: number | null;
  hrvBaseline: number | null;
  /** Respiratory rate is not tracked yet — pass null; the signal stays false. */
  respiratoryRate: number | null;
  respiratoryRateBaseline: number | null;

  consecutiveHardDays: number;
  goal: string;

  nutritionDays: NutritionDay[];
  nutritionTargets: { calorie_budget: number | null; protein_target: number | null };

  cycle: { include: boolean; phase: CyclePhase; days_remaining: number | null };
  hydration: { active: boolean; logged_ml: number | null; target_ml: number | null };

  hasBaselines: boolean;
  historyDays: number;
}

/** Derives the illness-proxy booleans from today's autonomic signals vs baselines. */
export function deriveIllnessSignals(s: CoachingInputSources): IllnessSignals {
  return {
    resting_hr_elevated:
      s.todayRestingHr != null &&
      s.restingHrBaseline != null &&
      s.todayRestingHr >= s.restingHrBaseline * RHR_ELEVATED_RATIO,
    hrv_suppressed:
      s.todayHrv != null &&
      s.hrvBaseline != null &&
      s.todayHrv <= s.hrvBaseline * HRV_SUPPRESSED_RATIO,
    respiratory_rate_elevated:
      s.respiratoryRate != null &&
      s.respiratoryRateBaseline != null &&
      s.respiratoryRate >= s.respiratoryRateBaseline * RESP_ELEVATED_RATIO,
  };
}

/** The lowest-scoring active pillar — the readiness limiter, or null. */
export function deriveLimitingPillar(computed: ComputedReadiness | null): ReadinessPillarId | null {
  if (!computed) return null;
  const active = computed.pillars.filter((p) => p.active);
  if (active.length === 0) return null;
  return active.reduce((lo, p) => (p.score < lo.score ? p : lo)).id;
}

/**
 * Maps extracted context primitives into the engine's DailyCoachingInput. Pure —
 * the hook does the context reads, this does the shaping (incl. the illness proxy).
 */
export function assembleCoachingInput(s: CoachingInputSources): DailyCoachingInput {
  return {
    date: s.date,
    readiness: {
      available: s.computed != null,
      score: s.computed?.score ?? null,
      recommendation: s.computed?.recommendation ?? null,
      limiting_pillar: deriveLimitingPillar(s.computed),
      reason: s.computed?.reason ?? null,
    },
    consecutive_hard_days: s.consecutiveHardDays,
    illness: deriveIllnessSignals(s),
    goal: s.goal,
    nutrition_days: s.nutritionDays,
    nutrition_targets: s.nutritionTargets,
    cycle: s.cycle,
    hydration: s.hydration,
    has_baselines: s.hasBaselines,
    history_days: s.historyDays,
  };
}
