import type { DailySummary } from '@/context/summary-context';
import {
  buildNutritionDaysFromSummaries,
  summaryToNutritionDay,
} from '@/utils/coaching-nutrition-days';

describe('coaching nutrition days', () => {
  const day = (date: string, calories: number, protein: number): DailySummary => ({
    date,
    calorie_budget: 2000,
    calories_consumed: calories,
    calories_burned: 0,
    net_calories: calories,
    delta: calories - 2000,
    protein_consumed: protein,
    carbs_consumed: 0,
    fat_consumed: 0,
    water_glasses: 0,
    calorie_burn_source: null,
  });

  it('marks days with zero calories as unlogged', () => {
    expect(summaryToNutritionDay(day('2026-07-06', 0, 0), '2026-07-06').logged).toBe(false);
  });

  it('builds a 3-day window newest-first with gaps as unlogged', () => {
    const rows = buildNutritionDaysFromSummaries('2026-07-06', [
      day('2026-07-06', 1800, 120),
      day('2026-07-04', 1500, 90),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0].date).toBe('2026-07-06');
    expect(rows[0].logged).toBe(true);
    expect(rows[1].date).toBe('2026-07-05');
    expect(rows[1].logged).toBe(false);
    expect(rows[2].date).toBe('2026-07-04');
    expect(rows[2].logged).toBe(true);
  });
});
