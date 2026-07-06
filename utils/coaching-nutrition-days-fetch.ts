import type { DailySummary } from '@/context/summary-context';
import type { NutritionDay } from '@/types/daily-coaching';
import { addLocalCalendarDays } from '@/utils/date';
import { fetchDailySummaryBundle } from '@/utils/daily-summary-cache';
import { summaryToNutritionDay } from '@/utils/coaching-nutrition-days';

const DEFAULT_LOOKBACK = 3;

/**
 * Fetches any missing days in the lookback window so the gap ranker has real
 * logged-day counts even when weekly summary hasn't hydrated yet.
 */
export async function fetchNutritionDays(
  userId: string,
  anchorDate: string,
  seed: DailySummary[],
  lookback = DEFAULT_LOOKBACK,
): Promise<NutritionDay[]> {
  const byDate = new Map(seed.map((s) => [s.date, s]));
  const dates = Array.from({ length: lookback }, (_, i) =>
    addLocalCalendarDays(anchorDate, -i),
  );

  await Promise.all(
    dates.map(async (date) => {
      if (byDate.has(date)) return;
      const bundle = await fetchDailySummaryBundle(userId, date);
      if (bundle?.daily) byDate.set(date, bundle.daily);
    }),
  );

  return dates.map((date) => summaryToNutritionDay(byDate.get(date), date));
}
