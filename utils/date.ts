export function getLocalDateString(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * "Jun 2" for the timestamp's LOCAL calendar day. Uses local Date getters rather
 * than `toLocaleDateString`, which on React Native's Hermes engine often formats
 * in UTC — so an evening log stored as the next UTC day renders a day ahead.
 */
export function formatMonthDayLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** Local day-of-month number for a timestamp (e.g. 2). */
export function localDayOfMonth(iso: string): number {
  return new Date(iso).getDate();
}

/** Full weekday name for the timestamp's LOCAL day (e.g. "Tuesday"). */
export function localWeekdayLong(iso: string): string {
  return WEEKDAYS_LONG[new Date(iso).getDay()] ?? '';
}

/** Short weekday for the timestamp's LOCAL day (e.g. "Tue"). */
export function localWeekdayShort(iso: string): string {
  return WEEKDAYS_SHORT[new Date(iso).getDay()] ?? '';
}

/** Whole calendar days between two timestamps, in LOCAL time (today = 0). */
export function localCalendarDaysAgo(iso: string, now: Date = new Date()): number {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
}

/** Shift a calendar day in local time (`YYYY-MM-DD`). Avoids UTC (`toISOString`) day skew. */
export function addLocalCalendarDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined || [y, m, d].some((n) => Number.isNaN(n))) {
    return getLocalDateString();
  }
  const next = new Date(y, m - 1, d + deltaDays);
  return getLocalDateString(next);
}
