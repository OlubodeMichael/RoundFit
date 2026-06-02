/** Local calendar date helpers for the sleep log screen. */

export function localSleepDateString(d = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function offsetSleepDate(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localSleepDateString(d);
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
