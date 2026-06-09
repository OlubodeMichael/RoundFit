/** Parse any ISO-ish timestamp; getters reflect the device local timezone. */
export function toDeviceLocalDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a timestamp as device-local time (e.g. "9:18 AM").
 * Uses the device locale and timezone — never UTC clock face.
 */
export function formatDeviceLocalTime(iso?: string): string | null {
  if (!iso) return null;
  const date = toDeviceLocalDate(iso);
  if (!date) return null;
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDeviceLocalTimeRange(
  startedAt?: string,
  endedAt?: string,
): string | null {
  const start = formatDeviceLocalTime(startedAt);
  const end = formatDeviceLocalTime(endedAt);
  if (start && end) return `${start} – ${end}`;
  return start ?? end;
}

/**
 * Normalise API timestamps for device-local display.
 * Manual rows sometimes return wall-clock with a bogus `Z`; strip it so the
 * face value is read in the device timezone. Health imports keep UTC semantics.
 */
export function normalizeStoredTimestampForDeviceLocal(
  iso: string | undefined,
  source: 'healthkit' | 'googlefit' | 'manual' | string,
): string | undefined {
  if (!iso) return undefined;
  if (source === 'healthkit' || source === 'googlefit') return iso;
  if (/[+-]\d{2}:\d{2}$/.test(iso)) return iso;
  if (/Z$/i.test(iso)) {
    return iso.replace(/\.\d{1,3}Z$/i, '').replace(/Z$/i, '');
  }
  return iso;
}

/** ISO-8601 with explicit local UTC offset (e.g. `2024-06-09T09:18:00-07:00`). */
export function toLocalOffsetIso(ms: number): string {
  const d = new Date(ms);
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(abs / 60)).padStart(2, '0');
  const offsetMins = String(abs % 60).padStart(2, '0');
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
}

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
