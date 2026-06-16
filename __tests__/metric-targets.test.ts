import {
  buildMetricTargetsConfig,
  computeLoggingStreak,
  computeWeeklyProgress,
  isCalorieMet,
  isMetricMet,
} from '@/utils/metric-targets';

describe('isCalorieMet', () => {
  it('uses proportional band with floor', () => {
    expect(isCalorieMet(1650, 1500)).toBe(true);
    expect(isCalorieMet(1350, 1500)).toBe(true);
    expect(isCalorieMet(1349, 1500)).toBe(false);
    expect(isCalorieMet(2700, 3000)).toBe(true);
    expect(isCalorieMet(3300, 3000)).toBe(true);
    expect(isCalorieMet(3340, 3000)).toBe(false);
  });

  it('returns null when inputs missing', () => {
    expect(isCalorieMet(0, 2000)).toBeNull();
    expect(isCalorieMet(1800, 0)).toBeNull();
  });
});

describe('isMetricMet', () => {
  it('requires 90% for at_least metrics', () => {
    expect(isMetricMet(135, 150, 'at_least')).toBe(true);
    expect(isMetricMet(134, 150, 'at_least')).toBe(false);
    expect(isMetricMet(7.2, 8, 'at_least')).toBe(true);
    expect(isMetricMet(7.1, 8, 'at_least')).toBe(false);
  });

  it('uses symmetric 90–110% band for near mode', () => {
    expect(isMetricMet(1900, 2000, 'near')).toBe(true);
    expect(isMetricMet(2200, 2000, 'near')).toBe(true);
    expect(isMetricMet(1790, 2000, 'near')).toBe(false);
  });
});

describe('computeWeeklyProgress', () => {
  const targets = buildMetricTargetsConfig({
    calorie_budget: 2000,
    protein_target: 150,
    steps_target: 8000,
    sleep_target: 8,
  });

  it('derives consistency and goals_hit from the same slots', () => {
    const result = computeWeeklyProgress(
      [
        {
          date: '2026-06-09',
          calories_consumed: 2000,
          protein_consumed: 150,
          calorie_budget: 2000,
          steps: 9000,
          sleep_hours: 8,
        },
        {
          date: '2026-06-10',
          calories_consumed: 2000,
          protein_consumed: 100,
          calorie_budget: 2000,
          steps: 4000,
          sleep_hours: 8,
        },
      ],
      targets,
    );

    expect(result.goals_hit).toBe(1);
    expect(result.consistency_score).toBeGreaterThan(0);
    expect(result.consistency_score).toBeLessThan(100);
    expect(result.days[0]?.met).toBe(true);
    expect(result.days[1]?.met).toBe(false);
  });

  it('skips protein slot when target is zero', () => {
    const noProtein = buildMetricTargetsConfig({
      calorie_budget: 2000,
      protein_target: 0,
    });
    const result = computeWeeklyProgress(
      [
        {
          date: '2026-06-09',
          calories_consumed: 2000,
          protein_consumed: 0,
          calorie_budget: 2000,
          steps: null,
          sleep_hours: null,
        },
      ],
      noProtein,
    );
    expect(result.goals_hit).toBe(1);
    expect(result.consistency_score).toBe(100);
  });
});

describe('computeLoggingStreak', () => {
  it('grace-skips empty anchor day', () => {
    const logged = new Set(['2026-06-14', '2026-06-13', '2026-06-12']);
    expect(computeLoggingStreak(logged, '2026-06-15')).toBe(3);
  });

  it('includes anchor when logged', () => {
    const logged = new Set(['2026-06-15', '2026-06-14']);
    expect(computeLoggingStreak(logged, '2026-06-15')).toBe(2);
  });

  it('returns zero when run is broken', () => {
    const logged = new Set(['2026-06-13']);
    expect(computeLoggingStreak(logged, '2026-06-15')).toBe(0);
  });
});
