import type { NutritionDay, NutritionGap, NutritionTargets } from '@/types/daily-coaching';

/**
 * Ranks nutrition shortfalls over a window of days.
 *
 *   gap_score = (target − avg_consumed) / target × min(days_under, 7) × completeness
 *
 * CRITICAL: only LOGGED days count. `avg_consumed` and `days_under` are computed
 * over `logged === true` days exclusively — we never claim "3 days under" when the
 * user logged fewer than 3 of those days. `completeness` (logged / total) damps the
 * score so a shortfall inferred from sparse logging can't dominate a well-logged one.
 *
 * Returns only genuine gaps (deficit > 0), highest gap_score first.
 */
export function rankNutritionGaps(
  days: NutritionDay[],
  targets: NutritionTargets,
): NutritionGap[] {
  const totalDays = days.length;
  const logged = days.filter((d) => d.logged);
  const loggedDays = logged.length;
  if (loggedDays === 0 || totalDays === 0) return [];

  const completeness = loggedDays / totalDays;

  const specs: { nutrient: NutritionGap['nutrient']; target: number | null; field: keyof NutritionDay }[] = [
    { nutrient: 'protein', target: targets.protein_target, field: 'protein_consumed' },
    { nutrient: 'calories', target: targets.calorie_budget, field: 'calories_consumed' },
  ];

  const gaps: NutritionGap[] = [];

  for (const { nutrient, target, field } of specs) {
    if (!target || target <= 0) continue;

    // Values from logged days only (a logged day with a null value is skipped).
    const values = logged
      .map((d) => d[field] as number | null)
      .filter((v): v is number => v != null);
    if (values.length === 0) continue;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const deficit = target - avg;
    if (deficit <= 0) continue; // no shortfall

    // Days under target — logged days only, by construction.
    const daysUnder = logged.filter((d) => {
      const v = d[field] as number | null;
      return v != null && v < target;
    }).length;

    const gapScore = (deficit / target) * Math.min(daysUnder, 7) * completeness;

    gaps.push({
      nutrient,
      avg_consumed: Math.round(avg),
      target: Math.round(target),
      deficit: Math.round(deficit),
      days_under: daysUnder,
      logged_days: loggedDays,
      gap_score: gapScore,
    });
  }

  return gaps.sort((a, b) => b.gap_score - a.gap_score);
}
