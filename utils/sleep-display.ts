import type { HealthData } from '@/context/health-context';
import type { RecoveryLog } from '@/context/recovery-context';
import { getLocalDateString } from '@/utils/date';
import { localSleepDateString } from '@/utils/sleep-date';

/** True between midnight and rollover hour — sleep UI still shows the prior wake-up day. */
export function isBeforeSleepDayRollover(now = new Date()): boolean {
  return localSleepDateString(now) !== getLocalDateString(now);
}

function calendarDayHasSleep(hours: number | null | undefined): boolean {
  return hours != null && hours > 0;
}

/**
 * Before the morning rollover, calendar-today often has no sleep yet. Surface
 * the prior wake-up day's sleep on today's health row for home/log/recovery.
 */
export function mergePriorDaySleepIntoHealth(
  calendarRow: HealthData | null,
  sleepDayRow: HealthData | null,
): HealthData | null {
  if (calendarDayHasSleep(calendarRow?.sleep_hours)) return calendarRow;
  if (!sleepDayRow || !calendarDayHasSleep(sleepDayRow.sleep_hours)) return calendarRow;

  const base = calendarRow ?? sleepDayRow;
  return {
    ...base,
    sleep_hours:       sleepDayRow.sleep_hours,
    sleep_quality:     sleepDayRow.sleep_quality ?? calendarRow?.sleep_quality ?? null,
    deep_sleep_hours:  sleepDayRow.deep_sleep_hours,
    rem_sleep_hours:   sleepDayRow.rem_sleep_hours,
    sleep_efficiency:  sleepDayRow.sleep_efficiency,
    time_in_bed_hours: sleepDayRow.time_in_bed_hours,
    bedtime_iso:       sleepDayRow.bedtime_iso,
    wakeup_iso:        sleepDayRow.wakeup_iso,
    date:              sleepDayRow.date ?? sleepDayRow.wakeup_iso
      ? getLocalDateString(new Date(sleepDayRow.wakeup_iso))
      : base.date,
  };
}

export function mergePriorDaySleepIntoRecovery(
  calendarRow: RecoveryLog | null,
  sleepDayRow: RecoveryLog | null,
): RecoveryLog | null {
  if (calendarDayHasSleep(calendarRow?.sleep_hours)) return calendarRow;
  if (!sleepDayRow || !calendarDayHasSleep(sleepDayRow.sleep_hours)) return calendarRow;

  const base = calendarRow ?? sleepDayRow;
  return {
    ...base,
    sleep_hours:       sleepDayRow.sleep_hours,
    sleep_quality:     sleepDayRow.sleep_quality ?? calendarRow?.sleep_quality ?? null,
    deep_sleep_hours:  sleepDayRow.deep_sleep_hours,
    rem_sleep_hours:   sleepDayRow.rem_sleep_hours,
    bedtime_iso:       sleepDayRow.bedtime_iso ?? calendarRow?.bedtime_iso ?? null,
    wakeup_iso:        sleepDayRow.wakeup_iso ?? calendarRow?.wakeup_iso ?? null,
  };
}
