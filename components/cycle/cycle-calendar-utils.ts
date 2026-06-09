export const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

export function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  );
}

export function buildWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const offset = first.getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const flat: (Date | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= total; day += 1) {
    flat.push(new Date(year, month, day));
  }
  while (flat.length % 7 !== 0) flat.push(null);
  const weeks: (Date | null)[][] = [];
  for (let index = 0; index < flat.length; index += 7) {
    weeks.push(flat.slice(index, index + 7));
  }
  return weeks;
}
