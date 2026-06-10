import {
  computeCycleScore,
  computeHrvScore,
  computeHydrationScore,
  computeNutritionScore,
  computeReadiness,
  computeSorenessScore,
  computeTrainingLoadScore,
  computeTrendDirection,
} from '@/utils/readiness';
import type { ReadinessInput } from '@/types/readiness';

describe('computeHydrationScore', () => {
  it('maps the logged/target ratio onto fixed bands', () => {
    expect(computeHydrationScore({ logged_ml: 2400, target_ml: 2500 })).toBe(100); // 0.96
    expect(computeHydrationScore({ logged_ml: 2000, target_ml: 2500 })).toBe(70); // 0.80
    expect(computeHydrationScore({ logged_ml: 1300, target_ml: 2500 })).toBe(45); // 0.52
    expect(computeHydrationScore({ logged_ml: 1000, target_ml: 2500 })).toBe(20); // 0.40
  });

  it('returns null before any water is logged or when the target is unknown', () => {
    expect(computeHydrationScore({ logged_ml: 0, target_ml: 2500 })).toBeNull();
    expect(computeHydrationScore({ logged_ml: 1500, target_ml: null })).toBeNull();
    expect(computeHydrationScore({ logged_ml: null, target_ml: 2500 })).toBeNull();
  });
});

describe('computeNutritionScore', () => {
  it('blends calorie (60%) and protein (40%) sub-scores', () => {
    expect(
      computeNutritionScore({ calories_consumed: 2000, calorie_budget: 2000, protein_consumed: 150, protein_target: 150 }),
    ).toBe(100);
    // cal 0.85 -> 75, protein 0.75 -> 60 => 75*.6 + 60*.4 = 69
    expect(
      computeNutritionScore({ calories_consumed: 1700, calorie_budget: 2000, protein_consumed: 112.5, protein_target: 150 }),
    ).toBe(69);
  });

  it('returns null when any required field is missing', () => {
    expect(
      computeNutritionScore({ calories_consumed: null, calorie_budget: 2000, protein_consumed: 150, protein_target: 150 }),
    ).toBeNull();
    expect(
      computeNutritionScore({ calories_consumed: 2000, calorie_budget: 0, protein_consumed: 150, protein_target: 150 }),
    ).toBeNull();
  });
});

describe('computeHrvScore', () => {
  it('scores the hrv/baseline ratio against the breakpoint curve', () => {
    expect(computeHrvScore({ hrv: 50, resting_heart_rate: null, hrv_baseline: 50, resting_hr_baseline: null })).toBe(85); // ratio 1.0
    expect(computeHrvScore({ hrv: 55, resting_heart_rate: null, hrv_baseline: 50, resting_hr_baseline: null })).toBe(100); // ratio 1.1
  });

  it('falls back to the current hrv as baseline when none is provided', () => {
    expect(computeHrvScore({ hrv: 42, resting_heart_rate: null, hrv_baseline: null, resting_hr_baseline: null })).toBe(85);
  });

  it('docks 10 points when resting HR is elevated >10% over baseline', () => {
    expect(computeHrvScore({ hrv: 50, resting_heart_rate: 60, hrv_baseline: 50, resting_hr_baseline: 50 })).toBe(75);
  });

  it('returns null without a usable hrv reading', () => {
    expect(computeHrvScore({ hrv: null, resting_heart_rate: 50, hrv_baseline: 50, resting_hr_baseline: 50 })).toBeNull();
    expect(computeHrvScore({ hrv: 0, resting_heart_rate: 50, hrv_baseline: 50, resting_hr_baseline: 50 })).toBeNull();
  });
});

describe('computeSorenessScore', () => {
  it('inverts soreness (1 = none → 100, 10 = max → 0)', () => {
    expect(computeSorenessScore(1, null)).toBe(100);
    expect(computeSorenessScore(10, null)).toBe(0);
  });

  it('maps energy levels when no soreness is logged', () => {
    expect(computeSorenessScore(null, 'low')).toBe(30);
    expect(computeSorenessScore(null, 'medium')).toBe(65);
    expect(computeSorenessScore(null, 'high')).toBe(100);
  });

  it('blends soreness (60%) and energy (40%) when both exist', () => {
    expect(computeSorenessScore(1, 'low')).toBe(72); // 100*.6 + 30*.4
  });

  it('returns null when neither signal is present', () => {
    expect(computeSorenessScore(null, null)).toBeNull();
  });
});

describe('computeCycleScore', () => {
  it('returns fixed scores per phase', () => {
    expect(computeCycleScore('follicular', null)).toBe(90);
    expect(computeCycleScore('ovulation', null)).toBe(85);
    expect(computeCycleScore('menstrual', null)).toBe(55);
  });

  it('declines gradually across the luteal phase', () => {
    expect(computeCycleScore('luteal', 14)).toBe(70); // start of luteal
    expect(computeCycleScore('luteal', 0)).toBe(49); // end (floored toward 45)
    expect(computeCycleScore('luteal', null)).toBe(70);
  });

  it('returns null for an unknown/absent phase', () => {
    expect(computeCycleScore(null as never, null)).toBeNull();
  });
});

describe('computeTrainingLoadScore', () => {
  it('returns a neutral 70 when there are no recent workouts', () => {
    expect(computeTrainingLoadScore([])).toBe(70);
  });
});

describe('computeReadiness', () => {
  function baseInput(): ReadinessInput {
    return {
      sleep: { sleep_hours: null, deep_sleep_hours: null, rem_sleep_hours: null, sleep_quality_rating: null, sleep_efficiency: null },
      hrv: { hrv: null, resting_heart_rate: null, hrv_baseline: null, resting_hr_baseline: null },
      workouts_7d: [],
      nutrition: { calories_consumed: null, calorie_budget: null, protein_consumed: null, protein_target: null },
      nutrition_prev: null,
      soreness: { soreness_level: null, energy_level: null, inferred: false },
      cycle: { phase: null, days_remaining: null, include_cycle: false },
      hydration: { logged_ml: null, target_ml: null },
      consecutive_hard_days: 0,
      sleep_quality_label: null,
    };
  }

  it('returns null when fewer than two pillars have data', () => {
    // Only training_load is active (it always defaults to 70); not enough.
    expect(computeReadiness(baseInput())).toBeNull();
  });

  it('aggregates a score once at least two pillars are active', () => {
    const input = baseInput();
    input.hydration = { logged_ml: 2400, target_ml: 2500 }; // 100, second active pillar
    const result = computeReadiness(input);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.score).toBeLessThanOrEqual(100);
    expect(result!.pillars.find((p) => p.id === 'hydration')?.active).toBe(true);
  });

  it('forces a Rest recommendation after three consecutive hard days', () => {
    const input = baseInput();
    input.hydration = { logged_ml: 2400, target_ml: 2500 };
    input.consecutive_hard_days = 3;
    expect(computeReadiness(input)!.recommendation).toBe('Rest');
  });
});

describe('computeTrendDirection', () => {
  const past = (n: number) => ({ date: `2020-01-0${n}`, score: 0 });

  it('is steady with no usable history', () => {
    expect(computeTrendDirection([], 80)).toEqual({ direction: 'steady', delta: 0, message: null });
  });

  it('reports falling when today is >8 below the trailing average', () => {
    const history = [{ ...past(1), score: 80 }, { ...past(2), score: 80 }, { ...past(3), score: 80 }];
    const trend = computeTrendDirection(history, 60);
    expect(trend.direction).toBe('falling');
    expect(trend.delta).toBe(-20);
    expect(trend.message).toMatch(/declining/i);
  });

  it('reports rising when today is >8 above the trailing average', () => {
    const history = [{ ...past(1), score: 50 }, { ...past(2), score: 50 }];
    expect(computeTrendDirection(history, 70).direction).toBe('rising');
  });

  it('ignores zero-score days and stays steady within the band', () => {
    const history = [{ ...past(1), score: 0 }, { ...past(2), score: 70 }];
    const trend = computeTrendDirection(history, 72);
    expect(trend.direction).toBe('steady');
    expect(trend.message).toBeNull();
  });
});
