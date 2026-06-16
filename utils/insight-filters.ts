import type { InsightListFilters } from '@/components/insights/InsightFilterMenu';
import { getLocalDateString } from '@/utils/date';
import { getWeekStart } from '@/utils/insights-aggregator';

export interface InsightDateFields {
  isoDate: string;
  date: string;
  dateLong: string;
}

export function matchesInsightDateQuery(
  insight: InsightDateFields,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (insight.isoDate.includes(q)) return true;
  if (insight.dateLong.toLowerCase().includes(q)) return true;
  if (insight.date.toLowerCase().includes(q)) return true;

  const raw = `${insight.isoDate}T00:00:00`;
  const d = new Date(raw);
  const tokens = [
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
    d.toLocaleDateString(undefined, { weekday: 'long' }),
    d.toLocaleDateString(undefined, { weekday: 'short' }),
    String(d.getDate()),
    String(d.getMonth() + 1).padStart(2, '0'),
  ];

  return tokens.some((token) => token.toLowerCase().includes(q));
}

export function isInsightInCurrentWeek(isoDate: string, today?: string): boolean {
  const end = today ?? getLocalDateString();
  const start = getWeekStart();
  return isoDate >= start && isoDate <= end;
}

export function filterInsightsByDate<T extends InsightDateFields>(
  items: T[],
  filters: InsightListFilters,
  today?: string,
): T[] {
  const end = today ?? getLocalDateString();
  let result = items;

  if (filters.scope === 'this_week') {
    result = result.filter((item) => isInsightInCurrentWeek(item.isoDate, end));
  }

  if (filters.dateQuery.trim()) {
    result = result.filter((item) =>
      matchesInsightDateQuery(item, filters.dateQuery),
    );
  }

  return result.sort((a, b) => {
    const cmp = b.isoDate.localeCompare(a.isoDate);
    return filters.sort === 'newest' ? cmp : -cmp;
  });
}
