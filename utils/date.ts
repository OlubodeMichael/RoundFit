export function getLocalDateString(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
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
