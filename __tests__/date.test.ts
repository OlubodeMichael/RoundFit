import {
  addLocalCalendarDays,
  formatMonthDayLocal,
  getLocalDateString,
  localCalendarDaysAgo,
  localWeekdayLong,
  normalizeStoredTimestampForDeviceLocal,
  toDeviceLocalDate,
} from '@/utils/date';

// These tests are deliberately timezone-agnostic: they use locally-constructed
// Date objects and noon-local timestamps (which never cross a calendar-day
// boundary in any timezone), so they pin the local-date contract regardless of
// the machine TZ. The contract they guard is the recurring bug: the app must
// compute "today"/day arithmetic in LOCAL time, never via UTC (toISOString).

describe('getLocalDateString', () => {
  it('formats a local Date as YYYY-MM-DD with zero-padding', () => {
    expect(getLocalDateString(new Date(2026, 5, 9))).toBe('2026-06-09');
    expect(getLocalDateString(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('defaults to today in YYYY-MM-DD shape', () => {
    expect(getLocalDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('addLocalCalendarDays', () => {
  it('adds and subtracts days within a month', () => {
    expect(addLocalCalendarDays('2026-06-09', 1)).toBe('2026-06-10');
    expect(addLocalCalendarDays('2026-06-09', -1)).toBe('2026-06-08');
    expect(addLocalCalendarDays('2026-06-09', 0)).toBe('2026-06-09');
  });

  it('rolls across month and year boundaries', () => {
    expect(addLocalCalendarDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addLocalCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addLocalCalendarDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles leap-year February correctly', () => {
    expect(addLocalCalendarDays('2028-02-28', 1)).toBe('2028-02-29'); // 2028 is a leap year
    expect(addLocalCalendarDays('2026-02-28', 1)).toBe('2026-03-01'); // 2026 is not
  });

  it('crosses a DST boundary without skewing the calendar day', () => {
    // US spring-forward 2026 is Mar 8; the result must still be a clean calendar day.
    expect(addLocalCalendarDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addLocalCalendarDays('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('falls back to today on malformed input', () => {
    expect(addLocalCalendarDays('not-a-date', 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('normalizeStoredTimestampForDeviceLocal', () => {
  it('strips a bogus Z (and millis) from manual wall-clock timestamps', () => {
    expect(normalizeStoredTimestampForDeviceLocal('2026-06-09T21:30:00.000Z', 'manual')).toBe(
      '2026-06-09T21:30:00',
    );
    expect(normalizeStoredTimestampForDeviceLocal('2026-06-09T21:30:00Z', 'manual')).toBe(
      '2026-06-09T21:30:00',
    );
  });

  it('keeps UTC semantics for device-sourced (healthkit/googlefit) timestamps', () => {
    const iso = '2026-06-09T21:30:00.000Z';
    expect(normalizeStoredTimestampForDeviceLocal(iso, 'healthkit')).toBe(iso);
    expect(normalizeStoredTimestampForDeviceLocal(iso, 'googlefit')).toBe(iso);
  });

  it('leaves timestamps that already carry an explicit offset untouched', () => {
    const iso = '2026-06-09T21:30:00-07:00';
    expect(normalizeStoredTimestampForDeviceLocal(iso, 'manual')).toBe(iso);
  });

  it('returns undefined for an absent timestamp', () => {
    expect(normalizeStoredTimestampForDeviceLocal(undefined, 'manual')).toBeUndefined();
  });
});

describe('toDeviceLocalDate', () => {
  it('parses a valid ISO timestamp', () => {
    expect(toDeviceLocalDate('2026-06-09T12:00:00')).toBeInstanceOf(Date);
  });

  it('returns null for an unparseable string', () => {
    expect(toDeviceLocalDate('garbage')).toBeNull();
  });
});

describe('local calendar readouts (noon-local = TZ-safe)', () => {
  it('formats month/day from the local calendar day', () => {
    expect(formatMonthDayLocal('2026-06-09T12:00:00')).toBe('Jun 9');
    expect(formatMonthDayLocal('garbage')).toBe('');
  });

  it('names the correct weekday', () => {
    // 2026-06-09 is a Tuesday.
    expect(localWeekdayLong('2026-06-09T12:00:00')).toBe('Tuesday');
  });

  it('counts whole local calendar days elapsed', () => {
    const now = new Date(2026, 5, 9, 12, 0, 0);
    expect(localCalendarDaysAgo('2026-06-09T12:00:00', now)).toBe(0);
    expect(localCalendarDaysAgo('2026-06-07T12:00:00', now)).toBe(2);
    expect(localCalendarDaysAgo('2026-06-10T12:00:00', now)).toBe(-1);
  });
});
