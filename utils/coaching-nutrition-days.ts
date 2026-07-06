import type { DailySummary } from '@/context/summary-context';
import type { NutritionDay } from '@/types/daily-coaching';
import { addLocalCalendarDays } from '@/utils/date';

const DEFAULT_LOOKBACK = 3;

/** Maps a daily summary row into the gap-ranker's NutritionDay shape. */
export function summaryToNutritionDay(
  summary: DailySummary | null | undefined,
  date: string,
): NutritionDay {
  if (!summary) {
    return { date, logged: false, calories_consumed: null, protein_consumed: null };
  }
  const logged = summary.calories_consumed > 0;
  return {
    date,
    logged,
    calories_consumed: logged ? summary.calories_consumed : null,
    protein_consumed: logged ? summary.protein_consumed : null,
  };
}

/**
 * Builds the last N calendar days of nutrition (newest first) from in-memory
 * summaries. Missing dates are marked unlogged.
 */
export function buildNutritionDaysFromSummaries(
  anchorDate: string,
  summaries: DailySummary[],
  lookback = DEFAULT_LOOKBACK,
): NutritionDay[] {
  const byDate = new Map(summaries.map((s) => [s.date, s]));
  const days: NutritionDay[] = [];
  for (let i = 0; i < lookback; i++) {
    const date = addLocalCalendarDays(anchorDate, -i);
    days.push(summaryToNutritionDay(byDate.get(date), date));
  }
  return days;
}
