import type { CyclePhase } from '@/context/cycle-context';
import type { EnergyLevel } from '@/context/checkin-context';
import type { SleepQuality } from '@/context/recovery-context';
import type { WorkoutIntensity } from '@/context/workout-context';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import type {
  ComputedReadiness,
  FactorStatus,
  HrvScoreInput,
  NutritionScoreInput,
  PillarScore,
  ReadinessFactor,
  ReadinessHistoryPoint,
  ReadinessInput,
  ReadinessPillarId,
  ReadinessRecommendation,
  ReadinessTip,
  ReadinessWorkoutInput,
  SleepScoreInput,
  SorenessScoreInput,
} from '@/types/readiness';
import { PILLAR_WEIGHTS } from '@/types/readiness';

export {
  PILLAR_WEIGHTS,
  type ComputedReadiness,
  type ReadinessFactor,
  type ReadinessHistoryPoint,
  type ReadinessInput,
  type ReadinessPillarId,
  type ReadinessRecommendation,
  type ReadinessTip,
} from '@/types/readiness';

const MIN_ACTIVE_PILLARS = 2;

const INTENSITY_MULTIPLIER: Record<WorkoutIntensity, number> = {
  light:     1.0,
  moderate:  1.5,
  hard:      2.5,
};

const HRV_BREAKPOINTS: [number, number][] = [
  [0.70, 10],
  [0.80, 35],
  [0.90, 60],
  [1.00, 85],
  [1.10, 100],
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerpBreakpoints(value: number, points: [number, number][]): number {
  if (points.length === 0) return 0;
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (value <= sorted[0][0]) return sorted[0][1];
  if (value >= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
  for (let i = 0; i < sorted.length - 1; i++) {
    const [x0, y0] = sorted[i];
    const [x1, y1] = sorted[i + 1];
    if (value >= x0 && value <= x1) {
      const t = (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return sorted[sorted.length - 1][1];
}

function scoreFromRatioInRange(
  ratio: number,
  idealMin: number,
  idealMax: number,
  floorScore: number,
  ceilingScore: number,
): number {
  if (ratio >= idealMin && ratio <= idealMax) return 100;
  if (ratio < idealMin) {
    const t = clamp((ratio - 0) / idealMin, 0, 1);
    return floorScore + t * (100 - floorScore);
  }
  const t = clamp((ratio - idealMax) / (1.5 - idealMax), 0, 1);
  return 100 - t * (100 - ceilingScore);
}

function statusFromScore(score: number): FactorStatus {
  if (score >= 70) return 'good';
  if (score >= 40) return 'ok';
  return 'poor';
}

function sleepQualityLabelToRating(quality: SleepQuality | null): number | null {
  if (!quality) return null;
  if (quality === 'poor') return 1;
  if (quality === 'fair') return 3;
  return 5;
}

function workoutStrain(w: ReadinessWorkoutInput): number {
  const mult = w.intensity ? INTENSITY_MULTIPLIER[w.intensity] : INTENSITY_MULTIPLIER.moderate;
  return w.duration_mins * mult;
}

function datesLastNDays(n: number, fromDate = getLocalDateString()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(addLocalCalendarDays(fromDate, -i));
  }
  return out;
}

// ── Pillar scorers ───────────────────────────────────────────────────────────

export function computeSleepScore(input: SleepScoreInput): number | null {
  const { sleep_hours, deep_sleep_hours, rem_sleep_hours, sleep_quality_rating, sleep_efficiency } = input;
  const hasDuration = sleep_hours !== null && sleep_hours > 0;
  const hasDeepRem = sleep_hours !== null && sleep_hours > 0
    && deep_sleep_hours !== null && rem_sleep_hours !== null;
  const subjective = sleep_quality_rating !== null
    ? clamp((sleep_quality_rating - 1) / 4, 0, 1) * 100
    : sleep_efficiency !== null
      ? clamp(sleep_efficiency, 0, 100)
      : null;

  if (!hasDuration && subjective === null) return null;

  let durationScore = 50;
  if (hasDuration && sleep_hours !== null) {
    if (sleep_hours >= 7 && sleep_hours <= 9) {
      durationScore = 100;
    } else if (sleep_hours < 5) {
      durationScore = 20;
    } else if (sleep_hours > 10) {
      durationScore = 80;
    } else if (sleep_hours < 7) {
      durationScore = 20 + ((sleep_hours - 5) / 2) * 80;
    } else {
      durationScore = 100 - ((sleep_hours - 9) / 1) * 20;
    }
  }

  if (!hasDeepRem) {
    if (!hasDuration) return subjective;
    const wDur = subjective !== null ? 0.65 : 1;
    const wSub = subjective !== null ? 0.35 : 0;
    return Math.round(durationScore * wDur + (subjective ?? 0) * wSub);
  }

  const total = sleep_hours as number;
  const deepRatio = (deep_sleep_hours as number) / total;
  const remRatio = (rem_sleep_hours as number) / total;
  const deepScore = scoreFromRatioInRange(deepRatio, 0.15, 0.25, 30, 70);
  const remScore = scoreFromRatioInRange(remRatio, 0.20, 0.25, 30, 70);
  const subScore = subjective ?? 50;

  return Math.round(
    durationScore * 0.40
    + deepScore * 0.25
    + remScore * 0.20
    + subScore * 0.15,
  );
}

export function computeHrvScore(input: HrvScoreInput): number | null {
  const { hrv, resting_heart_rate, hrv_baseline, resting_hr_baseline } = input;
  if (hrv === null || hrv <= 0) return null;

  const baseline = hrv_baseline !== null && hrv_baseline > 0 ? hrv_baseline : hrv;
  const ratio = hrv / baseline;
  let score = lerpBreakpoints(ratio, HRV_BREAKPOINTS);

  if (
    resting_heart_rate !== null
    && resting_hr_baseline !== null
    && resting_hr_baseline > 0
    && resting_heart_rate > resting_hr_baseline * 1.10
  ) {
    score = Math.max(0, score - 10);
  }

  return Math.round(clamp(score, 0, 100));
}

export function computeTrainingLoadScore(workouts7d: ReadinessWorkoutInput[]): number {
  if (workouts7d.length === 0) return 70;

  const today = getLocalDateString();
  const last3 = new Set(datesLastNDays(3, today));
  const last7 = new Set(datesLastNDays(7, today));

  let acute = 0;
  let chronicSum = 0;
  let chronicDays = 0;
  const strainByDate = new Map<string, number>();

  for (const w of workouts7d) {
    const d = w.date;
    if (!last7.has(d)) continue;
    const strain = workoutStrain(w);
    strainByDate.set(d, (strainByDate.get(d) ?? 0) + strain);
    if (last3.has(d)) acute += strain;
  }

  for (const d of last7) {
    const dayStrain = strainByDate.get(d) ?? 0;
    chronicSum += dayStrain;
    chronicDays += 1;
  }

  const chronic = chronicDays > 0 ? chronicSum / chronicDays : 0;
  if (chronic <= 0 && acute <= 0) return 70;

  const acr = chronic > 0 ? acute / (chronic * 3) : acute > 0 ? 2 : 1;

  let score: number;
  if (acr >= 0.8 && acr <= 1.3) {
    score = 80 + ((1.3 - Math.abs(acr - 1.05)) / 0.5) * 20;
  } else if (acr < 0.5) {
    score = 60;
  } else if (acr <= 1.5) {
    score = 50;
  } else {
    score = 20;
  }

  const yesterday = addLocalCalendarDays(today, -1);
  const hadWorkoutYesterday = (strainByDate.get(yesterday) ?? 0) > 0;
  if (!hadWorkoutYesterday && acr > 1.3) {
    score = Math.min(100, score + 10);
  }

  return Math.round(clamp(score, 0, 100));
}

/** Strain ring: higher = more accumulated load (inverse of readiness training pillar). */
export function computeStrainScore(workouts7d: ReadinessWorkoutInput[]): number {
  const readinessLoad = computeTrainingLoadScore(workouts7d);
  if (workouts7d.length === 0) return 35;

  const last3 = new Set(datesLastNDays(3));
  let acute = 0;
  for (const w of workouts7d) {
    if (last3.has(w.date)) acute += workoutStrain(w);
  }

  const acuteNorm = clamp((acute / 300) * 100, 0, 100);
  const fromAcr = 100 - readinessLoad;
  return Math.round(clamp(acuteNorm * 0.6 + fromAcr * 0.4, 0, 100));
}

export function computeNutritionScore(input: NutritionScoreInput): number | null {
  const { calories_consumed, calorie_budget, protein_consumed, protein_target } = input;
  if (
    calories_consumed === null
    || calorie_budget === null
    || calorie_budget <= 0
    || protein_consumed === null
    || protein_target === null
    || protein_target <= 0
  ) {
    return null;
  }

  const calRatio = clamp(calories_consumed / calorie_budget, 0.5, 1.5);
  let calScore: number;
  if (calRatio >= 0.9 && calRatio <= 1.1) calScore = 100;
  else if ((calRatio >= 0.8 && calRatio < 0.9) || (calRatio > 1.1 && calRatio <= 1.2)) calScore = 75;
  else calScore = 40;

  const protRatio = protein_consumed / protein_target;
  let protScore: number;
  if (protRatio >= 0.9) protScore = 100;
  else if (protRatio >= 0.7) protScore = 60;
  else protScore = 30;

  return Math.round(calScore * 0.6 + protScore * 0.4);
}

export function computeSorenessScore(
  soreness: number | null,
  energy: EnergyLevel | null,
): number | null {
  const hasSoreness = soreness !== null && soreness >= 1 && soreness <= 10;
  const hasEnergy = energy !== null;

  if (!hasSoreness && !hasEnergy) return null;

  let sorenessScore = 50;
  if (hasSoreness && soreness !== null) {
    sorenessScore = clamp(100 - ((soreness - 1) / 9) * 100, 0, 100);
  }

  let energyScore = 50;
  if (hasEnergy && energy !== null) {
    if (energy === 'low') energyScore = 30;
    else if (energy === 'medium') energyScore = 65;
    else energyScore = 100;
  }

  if (hasSoreness && hasEnergy) {
    return Math.round(sorenessScore * 0.6 + energyScore * 0.4);
  }
  if (hasSoreness) return Math.round(sorenessScore);
  return Math.round(energyScore);
}

export function computeCycleScore(
  phase: CyclePhase,
  daysRemaining: number | null,
): number | null {
  if (!phase) return null;

  switch (phase) {
    case 'follicular':
      return 90;
    case 'ovulation':
      return 85;
    case 'luteal':
      return daysRemaining !== null && daysRemaining <= 7 ? 50 : 70;
    case 'menstrual':
      return 55;
    default:
      return null;
  }
}

function recommendationFromScore(score: number): ReadinessRecommendation {
  if (score >= 85) return 'Train hard';
  if (score >= 65) return 'Moderate';
  if (score >= 40) return 'Light workout';
  return 'Rest';
}

const PILLAR_LABELS: Record<ReadinessPillarId, string> = {
  sleep:         'Sleep quality',
  hrv:           'HRV',
  training_load: 'Training load',
  nutrition:     'Nutrition',
  soreness:      'How you feel',
  cycle:         'Cycle phase',
};

const PILLAR_ICONS: Record<ReadinessPillarId, string> = {
  sleep:         'moon',
  hrv:           'pulse',
  training_load: 'barbell-outline',
  nutrition:     'nutrition-outline',
  soreness:      'body-outline',
  cycle:         'flower-outline',
};

function buildReason(pillars: PillarScore[]): string {
  const active = pillars.filter((p) => p.active);
  if (active.length === 0) return 'Log sleep, workouts, or a check-in to see your readiness.';

  const sorted = [...active].sort((a, b) => a.score - b.score);
  const top = sorted.slice(0, 2);
  const limiting = top.filter((p) => p.score < 70);
  const strong = [...active].sort((a, b) => b.score - a.score).slice(0, 2);

  if (limiting.length >= 2) {
    return `${PILLAR_LABELS[limiting[0].id]} and ${PILLAR_LABELS[limiting[1].id].toLowerCase()} are holding your score back today.`;
  }
  if (limiting.length === 1) {
    return `${PILLAR_LABELS[limiting[0].id]} is your main limiter today.`;
  }
  if (strong.length >= 2 && strong[0].score >= 75) {
    return `Strong ${PILLAR_LABELS[strong[0].id].toLowerCase()} and ${PILLAR_LABELS[strong[1].id].toLowerCase()} — you're primed for a solid session.`;
  }
  return 'Your signals are balanced — train according to how you feel.';
}

function buildTips(
  score: number,
  recommendation: ReadinessRecommendation,
  pillars: PillarScore[],
  proteinTarget: number | null,
): ReadinessTip[] {
  const tips: ReadinessTip[] = [];
  const byId = Object.fromEntries(pillars.map((p) => [p.id, p])) as Partial<Record<ReadinessPillarId, PillarScore>>;

  if (recommendation === 'Train hard' || recommendation === 'Moderate') {
    tips.push({
      icon: 'barbell-outline',
      text: recommendation === 'Train hard'
        ? 'High-intensity or heavy lifting is a good fit today.'
        : 'Standard training at moderate intensity fits your recovery today.',
    });
  } else if (recommendation === 'Light workout') {
    tips.push({
      icon: 'walk-outline',
      text: 'Favour active recovery — mobility, yoga, or an easy walk.',
    });
  } else {
    tips.push({
      icon: 'bed-outline',
      text: 'Prioritise rest today — gentle stretching or a short walk at most.',
    });
  }

  const nutrition = byId.nutrition;
  if (nutrition?.active && nutrition.score < 70 && proteinTarget) {
    tips.push({
      icon: 'nutrition-outline',
      text: `Prioritise protein — aim for ${proteinTarget} g to support recovery.`,
    });
  }

  const sleep = byId.sleep;
  if (sleep?.active && sleep.score < 65) {
    tips.push({
      icon: 'moon-outline',
      text: 'Aim for 7–9 hours tonight to rebuild your readiness score.',
    });
  }

  const load = byId.training_load;
  if (load?.active && load.score < 50) {
    tips.push({
      icon: 'fitness-outline',
      text: 'Training load is elevated — schedule a rest day or deload session.',
    });
  }

  return tips.slice(0, 3);
}

function formatSleepValue(hours: number | null): string {
  if (hours === null || hours <= 0) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function buildFactors(
  input: ReadinessInput,
  pillars: PillarScore[],
): ReadinessFactor[] {
  return pillars
    .filter((p) => p.active)
    .map((p) => {
      const status = statusFromScore(p.score);
      let value = `${p.score}`;
      let note = '';
      let ringScore: number | undefined;

      switch (p.id) {
        case 'sleep': {
          value = formatSleepValue(input.sleep.sleep_hours);
          const deep = input.sleep.deep_sleep_hours;
          const total = input.sleep.sleep_hours;
          if (deep !== null && total !== null && total > 0) {
            const pct = Math.round((deep / total) * 100);
            note = `Deep sleep ${pct}%`;
          } else {
            note = 'Sleep duration logged';
          }
          ringScore = p.score;
          break;
        }
        case 'hrv': {
          value = input.hrv.hrv !== null ? `${Math.round(input.hrv.hrv)} ms` : '—';
          if (input.hrv.hrv_baseline && input.hrv.hrv) {
            const delta = Math.round(((input.hrv.hrv / input.hrv.hrv_baseline) - 1) * 100);
            note = delta >= 0 ? `+${delta}% vs your baseline` : `${delta}% vs your baseline`;
          } else {
            note = 'Heart rate variability';
          }
          break;
        }
        case 'training_load': {
          const days = new Set(input.workouts_7d.map((w) => w.date)).size;
          value = p.score >= 70 ? 'Balanced' : p.score >= 40 ? 'Moderate' : 'High';
          note = `${days} training day${days === 1 ? '' : 's'} this week`;
          break;
        }
        case 'nutrition': {
          const prot = input.nutrition.protein_consumed;
          value = prot !== null ? `${Math.round(prot)} g protein` : '—';
          const target = input.nutrition.protein_target;
          if (target && prot !== null) {
            note = prot >= target * 0.9
              ? 'On track with protein'
              : `Below your ${Math.round(target)} g target`;
          }
          break;
        }
        case 'soreness': {
          value = input.soreness.energy_level
            ? input.soreness.energy_level.charAt(0).toUpperCase() + input.soreness.energy_level.slice(1)
            : 'Logged';
          note = input.soreness.soreness_level !== null
            ? `Soreness ${input.soreness.soreness_level}/10`
            : 'From your morning check-in';
          break;
        }
        case 'cycle': {
          value = input.cycle.phase
            ? input.cycle.phase.charAt(0).toUpperCase() + input.cycle.phase.slice(1)
            : '—';
          note = input.cycle.days_remaining !== null
            ? `~${input.cycle.days_remaining} days to next phase`
            : 'Cycle-adjusted readiness';
          break;
        }
        default:
          break;
      }

      return {
        pillar:     p.id,
        label:      PILLAR_LABELS[p.id],
        icon:       PILLAR_ICONS[p.id],
        value,
        note,
        status,
        score:      p.score,
        ringScore,
      };
    });
}

/** Aggregate readiness from all pillars. Returns null if fewer than 2 pillars have data. */
export function computeReadiness(input: ReadinessInput): ComputedReadiness | null {
  const sleepRating = input.sleep.sleep_quality_rating
    ?? sleepQualityLabelToRating(input.sleep_quality_label);

  const sleepScore = computeSleepScore({
    ...input.sleep,
    sleep_quality_rating: sleepRating,
  });

  const hrvScore = computeHrvScore(input.hrv);
  const trainingScore = computeTrainingLoadScore(input.workouts_7d);
  const nutritionScore = computeNutritionScore(input.nutrition);
  const sorenessScore = computeSorenessScore(
    input.soreness.soreness_level,
    input.soreness.energy_level,
  );
  const cycleScore = input.cycle.include_cycle
    ? computeCycleScore(input.cycle.phase, input.cycle.days_remaining)
    : null;

  const raw: { id: ReadinessPillarId; score: number | null }[] = [
    { id: 'sleep',          score: sleepScore },
    { id: 'hrv',            score: hrvScore },
    { id: 'training_load',  score: trainingScore },
    { id: 'nutrition',      score: nutritionScore },
    { id: 'soreness',       score: sorenessScore },
    { id: 'cycle',          score: cycleScore },
  ];

  const activePillars = raw.filter((r) => r.score !== null) as { id: ReadinessPillarId; score: number }[];
  if (activePillars.length < MIN_ACTIVE_PILLARS) return null;

  let weightSum = 0;
  let weighted = 0;
  const pillars: PillarScore[] = raw.map((r) => {
    const weight = PILLAR_WEIGHTS[r.id];
    const active = r.score !== null;
    if (active && r.score !== null) {
      weightSum += weight;
      weighted += r.score * weight;
    }
    return {
      id:     r.id,
      label:  PILLAR_LABELS[r.id],
      score:  r.score ?? 0,
      weight,
      active,
    };
  });

  const score = Math.round(clamp(weighted / weightSum, 0, 100));
  const recommendation = recommendationFromScore(score);
  const reason = buildReason(pillars);
  const factors = buildFactors(input, pillars);
  const tips = buildTips(
    score,
    recommendation,
    pillars,
    input.nutrition.protein_target,
  );

  return {
    score,
    recommendation,
    reason,
    pillars,
    factors,
    tips,
    sleep_score: sleepScore,
    strain_score: computeStrainScore(input.workouts_7d),
  };
}

/** Build an N-day trend from historical readiness rows or per-day computation. */
export function buildReadinessTrend(
  serverHistory: ReadinessHistoryPoint[],
  computeForDate?: (date: string) => ComputedReadiness | null,
  days = 7,
): ReadinessHistoryPoint[] {
  const dayList = datesLastNDays(days);
  const byDate = new Map(serverHistory.map((p) => [p.date, p.score]));

  return dayList.map((date) => {
    const fromServer = byDate.get(date);
    if (fromServer !== undefined) return { date, score: fromServer };
    const computed = computeForDate?.(date);
    return { date, score: computed?.score ?? 0 };
  });
}
