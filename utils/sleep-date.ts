/** Local calendar date helpers for the sleep log screen. */

import { getLocalDateString } from '@/utils/date';

/**
 * Hour (0–23) when the app treats the wake-up calendar day as "today" for sleep.
 * Before this time, the previous calendar day's sleep stays on screen.
 */
export const SLEEP_DAY_ROLLOVER_HOUR = 6;

/** Wake-up calendar day used for sleep log navigation and display. */
export function localSleepDateString(d = new Date()): string {
  const calendar = getLocalDateString(d);
  if (d.getHours() < SLEEP_DAY_ROLLOVER_HOUR) {
    return offsetSleepDate(calendar, -1);
  }
  return calendar;
}

export function offsetSleepDate(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

export function formatSleepNavDate(iso: string): string {
  const today = localSleepDateString();
  if (iso === today) return 'Today';
  if (iso === offsetSleepDate(today, -1)) return 'Yesterday';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function capitalFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
