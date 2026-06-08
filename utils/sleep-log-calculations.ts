import type { HealthData } from '@/context/health-context';
import type { RecoveryLog, RecoverySource, SleepQuality } from '@/context/recovery-context';
import { getLocalDateString } from '@/utils/date';
import type { SleepSegment } from '@/utils/healthkit';
import type { SleepStageSummaryRow, SleepFormFields } from '@/types/sleep-log';
import {
  deriveSleepQuality,
  type SleepQualityUi,
} from '@/utils/sleep-quality';
import {
  clockToIso,
  computeSleepWindowHours,
  estimateBedtime,
  isoToClockString,
  sleepHoursToDisplay,
  type SleepHoursResult,
} from '@/utils/sleep-time';

export const SLEEP_FORM_DEFAULTS: { bedtime: string; wakeup: string } = {
  bedtime: '11:00 PM',
  wakeup:  '7:00 AM',
};

export interface StageSummaryColors {
  sleep: string;
  water: string;
  fat: string;
  carbs: string;
}

/** Hero duration: bed/wake window when set, else HealthKit time asleep. */
export function resolveDisplayHours(
  bedtime: string,
  wakeup: string,
  hkSleepHours: number | null | undefined,
): SleepHoursResult {
  const fromWindow = computeSleepWindowHours(bedtime, wakeup);
  const isPlaceholder =
    bedtime === SLEEP_FORM_DEFAULTS.bedtime && wakeup === SLEEP_FORM_DEFAULTS.wakeup;

  if (fromWindow.rawHours > 0 && !isPlaceholder) {
    return fromWindow;
  }

  if (hkSleepHours != null && hkSleepHours > 0) {
    return sleepHoursToDisplay(hkSleepHours);
  }

  return fromWindow;
}

export function parseDeepSleepInput(deepH: string, deepM: string): number | null {
  const h = parseInt(deepH, 10) || 0;
  const m = parseInt(deepM, 10) || 0;
  return h > 0 || m > 0 ? h + m / 60 : null;
}

export function deriveQualityFromForm(
  rawHours: number,
  parsedDeepHours: number | null,
): { score: number; quality: SleepQualityUi } {
  if (rawHours <= 0) return { score: 0, quality: 'good' };
  return deriveSleepQuality({
    sleep_hours:              rawHours,
    deep_sleep_hours:         parsedDeepHours,
    includeWearableMetrics: false,
  });
}

/** Full HealthKit scoring (duration, efficiency, REM, deep). */
export function deriveQualityFromHealthKit(hk: HealthData): { score: number; quality: SleepQualityUi } {
  const h = hk.sleep_hours ?? 0;
  if (h <= 0) return { score: 0, quality: 'good' };
  return deriveSleepQuality({
    sleep_hours:              h,
    deep_sleep_hours:         hk.deep_sleep_hours,
    rem_sleep_hours:          hk.rem_sleep_hours,
    sleep_efficiency:         hk.sleep_efficiency,
    includeWearableMetrics: true,
  });
}

/** Apple Health read-only UI when we have HK sleep and no manual override for this date. */
export function isHealthKitDisplayMode(
  hk: HealthData | null,
  persistedManualLog: boolean,
  manualMode: boolean,
): boolean {
  return hk != null && !persistedManualLog && !manualMode;
}

/** Hero: time-asleep from HealthKit in HK mode; otherwise bed/wake window. */
export function resolveHeroHours(
  isHealthKitView: boolean,
  hk: HealthData | null,
  bedtime: string,
  wakeup: string,
  savedManualHours: number | null = null,
): SleepHoursResult {
  if (isHealthKitView && hk?.sleep_hours != null && hk.sleep_hours > 0) {
    return sleepHoursToDisplay(hk.sleep_hours);
  }
  // A saved manual log shows the stored sleep_hours directly, so the card always
  // reflects what was logged (not a recompute from bedtime/wake-up).
  if (savedManualHours != null && savedManualHours > 0) {
    return sleepHoursToDisplay(savedManualHours);
  }
  return resolveDisplayHours(bedtime, wakeup, hk?.sleep_hours);
}

export function healthKitToFormFields(hk: HealthData): Pick<SleepFormFields, 'bedtime' | 'wakeup' | 'deepH' | 'deepM'> {
  let deepH = '';
  let deepM = '';
  if (hk.deep_sleep_hours != null && hk.deep_sleep_hours > 0) {
    const totalMin = Math.round(hk.deep_sleep_hours * 60);
    deepH = String(Math.floor(totalMin / 60));
    deepM = String(totalMin % 60);
  }

  let bedtime = SLEEP_FORM_DEFAULTS.bedtime;
  let wakeup  = SLEEP_FORM_DEFAULTS.wakeup;

  if (hk.bedtime_iso) {
    bedtime = isoToClockString(hk.bedtime_iso);
  } else if (hk.sleep_hours != null && hk.sleep_hours > 0) {
    bedtime = estimateBedtime(hk.sleep_hours).bedtime;
  }

  if (hk.wakeup_iso) {
    wakeup = isoToClockString(hk.wakeup_iso);
  } else if (hk.sleep_hours != null && hk.sleep_hours > 0) {
    wakeup = estimateBedtime(hk.sleep_hours).wakeup;
  }

  return { bedtime, wakeup, deepH, deepM };
}

export function recoveryToFormFields(
  log: RecoveryLog,
  hk: HealthData | null,
): Pick<SleepFormFields, 'bedtime' | 'wakeup' | 'deepH' | 'deepM'> {
  if (hk) return healthKitToFormFields(hk);
  if (log.sleep_hours == null || log.sleep_hours <= 0) {
    return { bedtime: SLEEP_FORM_DEFAULTS.bedtime, wakeup: SLEEP_FORM_DEFAULTS.wakeup, deepH: '', deepM: '' };
  }
  const est = estimateBedtime(log.sleep_hours);
  return { bedtime: est.bedtime, wakeup: est.wakeup, deepH: '', deepM: '' };
}

export function buildInitialFormFields(
  hk: HealthData | null,
  recovery: RecoveryLog | null,
): SleepFormFields {
  const times = hk
    ? healthKitToFormFields(hk)
    : recovery
      ? recoveryToFormFields(recovery, null)
      : { bedtime: SLEEP_FORM_DEFAULTS.bedtime, wakeup: SLEEP_FORM_DEFAULTS.wakeup, deepH: '', deepM: '' };

  const quality: SleepQualityUi = recovery?.sleep_quality
    ? (recovery.sleep_quality as SleepQualityUi)
    : 'good';

  return {
    ...times,
    quality,
    qualityScore: recovery?.sleep_score ?? null,
    notes:        recovery?.notes ?? '',
  };
}

export function computeStageSummary(
  segments: SleepSegment[],
  colors: StageSummaryColors,
): SleepStageSummaryRow[] {
  const sum = (stage: string) =>
    segments
      .filter((s) => s.stage === stage)
      .reduce((acc, s) => acc + s.end.getTime() - s.start.getTime(), 0);

  const remMs   = sum('rem');
  const lightMs = sum('core');
  const deepMs  = sum('deep');
  const awakeMs = sum('awake');
  const totalMs = remMs + lightMs + deepMs;
  const pct = (ms: number) => (totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0);

  return [
    { label: 'REM',   ms: remMs,   pct: pct(remMs),   color: colors.sleep },
    { label: 'LIGHT', ms: lightMs, pct: pct(lightMs), color: colors.water },
    { label: 'DEEP',  ms: deepMs,  pct: pct(deepMs),  color: colors.fat   },
    { label: 'AWAKE', ms: awakeMs, pct: pct(awakeMs), color: colors.carbs },
  ];
}

export function countRemCycles(segments: SleepSegment[]): number {
  return segments.filter((s) => s.stage === 'rem').length;
}

export function hasHypnogramSegments(segments: SleepSegment[]): boolean {
  return segments.some((s) => ['awake', 'rem', 'core', 'deep'].includes(s.stage));
}

export function hypnogramWindow(hk: HealthData | null): { windowStart?: Date; windowEnd?: Date } {
  return {
    windowStart: hk?.bedtime_iso ? new Date(hk.bedtime_iso) : undefined,
    windowEnd:   hk?.wakeup_iso  ? new Date(hk.wakeup_iso)  : undefined,
  };
}

export function toApiSleepQuality(quality: SleepQualityUi): SleepQuality {
  return quality === 'great' ? 'good' : quality;
}

export interface SleepSaveInput {
  activeDate: string;
  isToday: boolean;
  bedtime: string;
  wakeup: string;
  deepH: string;
  deepM: string;
  quality: SleepQualityUi;
  qualityScore: number | null;
  derivedScore: number;
  notes: string;
  hours: SleepHoursResult;
  hk: HealthData | null;
}

export function buildSleepSavePayload(input: SleepSaveInput) {
  const sleepH = input.hours.rawHours > 0
    ? input.hours.rawHours
    : (input.hk?.sleep_hours ?? 0);

  const parsedDeep = parseDeepSleepInput(input.deepH, input.deepM);
  const deepSleepH = parsedDeep ?? input.hk?.deep_sleep_hours ?? undefined;

  const bedtimeIso = input.hk?.bedtime_iso
    ?? clockToIso(input.bedtime, input.activeDate, 'bedtime')
    ?? undefined;
  const wakeupIso = input.hk?.wakeup_iso
    ?? clockToIso(input.wakeup, input.activeDate, 'wakeup')
    ?? undefined;

  return {
    sleepH,
    deepSleepH,
    bedtimeIso,
    wakeupIso,
    recoveryBody: {
      sleep_hours:      sleepH > 0 ? sleepH : undefined,
      sleep_quality:    toApiSleepQuality(input.quality),
      sleep_score:      input.qualityScore ?? input.derivedScore,
      deep_sleep_hours: deepSleepH,
      rem_sleep_hours:  input.hk?.rem_sleep_hours ?? undefined,
      notes:            input.notes.trim() || undefined,
      source:           'manual' as const,
      date:             input.activeDate,
      bedtime_iso:      bedtimeIso,
      wakeup_iso:       wakeupIso,
    },
    healthBody: {
      source:           'manual' as const,
      date:             input.activeDate,
      sleep_hours:      sleepH,
      sleep_quality:    toApiSleepQuality(input.quality),
      deep_sleep_hours: deepSleepH,
      rem_sleep_hours:  input.hk?.rem_sleep_hours ?? undefined,
      bedtime_iso:      bedtimeIso,
      wakeup_iso:       wakeupIso,
    },
    toastLabel: `${input.hours.label} · ${input.quality.charAt(0).toUpperCase()}${input.quality.slice(1)}`,
  };
}

/**
 * Sleep log dates are wake-up calendar days. Match health rows by `date`,
 * `wakeup_iso`, or the date used in GET /health/today?date=.
 */
export function healthDataForSleepDate(
  data: HealthData | null,
  wakeDate: string,
): HealthData | null {
  if (!data) return null;

  if (data.date) {
    return data.date === wakeDate ? data : null;
  }

  if (data.wakeup_iso) {
    const wake = getLocalDateString(new Date(data.wakeup_iso));
    if (wake === wakeDate) return data;
    return null;
  }

  // Row was fetched with ?date=wakeDate — no explicit date fields to contradict it.
  return data;
}

export function isPersistedManualLog(
  savedSource: RecoverySource | null,
  health: HealthData | null,
  activeDate: string,
): boolean {
  if (savedSource === 'manual') return true;
  const row = healthDataForSleepDate(health, activeDate);
  return row?.source === 'manual' && (row.sleep_hours ?? 0) > 0;
}

export function recoveryLogForDate(
  recovery: RecoveryLog | null,
  activeDate: string,
): RecoveryLog | null {
  if (!recovery) return null;
  if (recovery.recorded_at.split('T')[0] === activeDate) return recovery;
  return null;
}
