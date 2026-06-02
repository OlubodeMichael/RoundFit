/** Clock strings, bedtime/wake window math, and ISO conversion for sleep logging. */

export interface SleepHoursResult {
  hours: number;
  minutes: number;
  rawHours: number;
  label: string;
}

export function parseClock(value: string): { h: number; m: number } | null {
  const m = value.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const mer = m[3];
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/** Decimal hours (e.g. 7.25) → { hours: 7, minutes: 15, … } */
export function sleepHoursToDisplay(hours: number): SleepHoursResult {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return {
    hours:    h,
    minutes:  m,
    rawHours: hours,
    label:    `${h}h ${String(m).padStart(2, '0')}m`,
  };
}

export function computeSleepWindowHours(bedtime: string, wake: string): SleepHoursResult {
  const b = parseClock(bedtime);
  const w = parseClock(wake);
  if (!b || !w) return { hours: 0, minutes: 0, rawHours: 0, label: '—' };
  const bedMin  = b.h * 60 + b.m;
  const wakeMin = w.h * 60 + w.m;
  let diff = wakeMin - bedMin;
  if (diff <= 0) diff += 24 * 60;
  const hours    = Math.floor(diff / 60);
  const minutes  = diff % 60;
  const rawHours = diff / 60;
  return { hours, minutes, rawHours, label: `${hours}h ${String(minutes).padStart(2, '0')}m` };
}

export function clockToIso(
  clock: string,
  wakeDate: string,
  role: 'bedtime' | 'wakeup',
): string | null {
  const parsed = parseClock(clock);
  if (!parsed) return null;
  const [y, mo, d] = wakeDate.split('-').map(Number);
  if (role === 'wakeup') {
    return new Date(y, (mo ?? 1) - 1, d ?? 1, parsed.h, parsed.m, 0, 0).toISOString();
  }
  const isPM = parsed.h >= 12;
  const date = isPM
    ? new Date(y, (mo ?? 1) - 1, (d ?? 1) - 1, parsed.h, parsed.m, 0, 0)
    : new Date(y, (mo ?? 1) - 1,  d ?? 1,        parsed.h, parsed.m, 0, 0);
  return date.toISOString();
}

export function isoToClockString(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function estimateBedtime(sleepHours: number): { bedtime: string; wakeup: string } {
  const wakeMin       = 7 * 60;
  const totalSleepMin = Math.round(sleepHours * 60);
  let bedTotalMin     = wakeMin - totalSleepMin;
  if (bedTotalMin < 0) bedTotalMin += 24 * 60;
  const bH   = Math.floor(bedTotalMin / 60);
  const bM   = bedTotalMin % 60;
  const isPM = bH >= 12 && bH < 24;
  const bH12 = bH % 12 || 12;
  return {
    bedtime: `${bH12}:${String(bM).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`,
    wakeup:  '7:00 AM',
  };
}

export function formatStageDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}
