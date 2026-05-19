import type { ReadinessHistoryPoint } from '@/types/readiness';
import { getLocalDateString } from '@/utils/date';

export type TrendPalette = {
  protein: string;
  carbs: string;
  calories: string;
  text: string;
  textDim: string;
  textFaint: string;
  card: string;
  cardEdge: string;
  hair: string;
  sunken: string;
  isDark: boolean;
};

export interface TrendStats {
  average: number | null;
  high: number | null;
  low: number | null;
  loggedDays: number;
  totalDays: number;
  /** Positive = improving over the period (second half vs first half). */
  momentum: number | null;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function scoreTint(score: number, palette: TrendPalette): string {
  if (score >= 70) return palette.protein;
  if (score >= 40) return palette.carbs;
  return palette.calories;
}

export function scoreSoft(score: number, palette: TrendPalette): string {
  if (score >= 70) return palette.isDark ? 'rgba(52,211,153,0.22)' : 'rgba(16,185,129,0.14)';
  if (score >= 40) return palette.isDark ? 'rgba(251,191,36,0.22)' : 'rgba(245,158,11,0.14)';
  return palette.isDark ? 'rgba(255,120,73,0.22)' : 'rgba(255,120,73,0.14)';
}

export function computeTrendStats(points: ReadinessHistoryPoint[]): TrendStats {
  const logged = points.filter((p) => p.score > 0);
  const totalDays = points.length;

  if (logged.length === 0) {
    return {
      average: null,
      high: null,
      low: null,
      loggedDays: 0,
      totalDays,
      momentum: null,
    };
  }

  const scores = logged.map((p) => p.score);
  const average = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const high = Math.max(...scores);
  const low = Math.min(...scores);

  let momentum: number | null = null;
  if (logged.length >= 4) {
    const mid = Math.floor(logged.length / 2);
    const first = logged.slice(0, mid);
    const second = logged.slice(mid);
    const avgFirst = first.reduce((s, p) => s + p.score, 0) / first.length;
    const avgSecond = second.reduce((s, p) => s + p.score, 0) / second.length;
    momentum = Math.round(avgSecond - avgFirst);
  }

  return {
    average,
    high,
    low,
    loggedDays: logged.length,
    totalDays,
    momentum,
  };
}

export function weekdayLetter(date: string): string {
  return WEEKDAY_LETTERS[new Date(`${date}T12:00:00`).getDay()];
}

export function dayOfMonth(date: string): number {
  return new Date(`${date}T12:00:00`).getDate();
}

export function isToday(date: string): boolean {
  return date === getLocalDateString();
}

export function periodRangeLabel(points: ReadinessHistoryPoint[]): string {
  if (points.length === 0) return '';
  const first = points[0].date;
  const last = points[points.length - 1].date;
  const fd = new Date(`${first}T12:00:00`);
  const ld = new Date(`${last}T12:00:00`);
  const fStr = `${MONTHS_SHORT[fd.getMonth()]} ${fd.getDate()}`;
  const lStr = `${MONTHS_SHORT[ld.getMonth()]} ${ld.getDate()}`;
  if (first === last) return fStr;
  return `${fStr} – ${lStr}`;
}

export function formatMomentum(delta: number | null): string | null {
  if (delta === null) return null;
  if (delta === 0) return 'Steady';
  return delta > 0 ? `+${delta} pts` : `${delta} pts`;
}

export interface MonthCalendarCell {
  date: string | null;
  day: number | null;
}

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Monday-start grid for the month containing `referenceDate` (default today). */
export function buildCurrentMonthGrid(referenceDate = getLocalDateString()): MonthCalendarCell[][] {
  const [y, m] = referenceDate.split('-').map(Number);
  if (!y || !m) return [];

  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const padStart = (first.getDay() + 6) % 7;

  const cells: MonthCalendarCell[] = [];
  for (let i = 0; i < padStart; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push({ date: `${y}-${mm}-${dd}`, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });

  const rows: MonthCalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

export function currentMonthTitle(referenceDate = getLocalDateString()): string {
  const [y, m] = referenceDate.split('-').map(Number);
  if (!y || !m) return '';
  return `${MONTHS_FULL[m - 1]} ${y}`;
}

export function currentMonthShort(referenceDate = getLocalDateString()): string {
  const [y, m] = referenceDate.split('-').map(Number);
  if (!y || !m) return '';
  return MONTHS_SHORT[m - 1].toUpperCase();
}
