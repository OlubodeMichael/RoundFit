import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { usePostHog } from 'posthog-react-native';

import { useToast } from '@/components/ui/Toast';
import { useHealth } from '@/hooks/use-health';
import { useRecovery } from '@/hooks/use-recovery';
import type { HealthData } from '@/context/health-context';
import type { RecoveryLog, RecoverySource } from '@/context/recovery-context';
import type { SleepLogScreenViewModel } from '@/types/sleep-log';
import {
  getHealthKitModule,
  readSleepSegmentsForNight,
  type SleepSegment,
} from '@/utils/healthkit';
import { type SleepQualityUi } from '@/utils/sleep-quality';
import { formatSleepNavDate, localSleepDateString, offsetSleepDate } from '@/utils/sleep-date';
import {
  buildInitialFormFields,
  buildSleepSavePayload,
  computeStageSummary,
  countRemCycles,
  deriveQualityFromForm,
  deriveQualityFromHealthKit,
  hasHypnogramSegments,
  healthDataForSleepDate,
  hypnogramWindow,
  isHealthKitDisplayMode,
  isPersistedManualLog,
  parseDeepSleepInput,
  recoveryLogForDate,
  resolveHeroHours,
  SLEEP_FORM_DEFAULTS,
} from '@/utils/sleep-log-calculations';
import { usePalette } from '@/lib/log-theme';

export interface SleepLogActions {
  navigateDate: (dir: -1 | 1) => void;
  setQualityExpanded: Dispatch<SetStateAction<boolean>>;
  setNotesExpanded: Dispatch<SetStateAction<boolean>>;
  setDeepH: (v: string) => void;
  setDeepM: (v: string) => void;
  setNotes: (v: string) => void;
  setPickerVisible: (v: boolean) => void;
  confirmTimePicker: (bedtime: string, wakeup: string) => void;
  handleSave: () => void;
  setNoSleepModalVisible: (v: boolean) => void;
  enterManualMode: () => void;
}

export function useSleepLog(): { view: SleepLogScreenViewModel; actions: SleepLogActions } {
  const P       = usePalette();
  const toast   = useToast();
  const health  = useHealth();
  const posthog = usePostHog();
  const {
    logRecovery,
    refresh: refreshRecovery,
    fetchRecoveryByDate,
  } = useRecovery();
  const { fetchForDate: fetchHealthForDate } = health;

  const today = localSleepDateString();
  const [activeDate, setActiveDate] = useState(today);
  const isToday = activeDate === today;

  useEffect(() => {
    setActiveDate((prev) => {
      if (prev > today) return today;
      const priorSleepDay = offsetSleepDate(today, -1);
      if (prev === priorSleepDay) return today;
      return prev;
    });
  }, [today]);

  const segmentCache   = useRef<Map<string, SleepSegment[]>>(new Map());

  const [dateHealthData, setDateHealthData]     = useState<HealthData | null>(null);
  const [dateRecoveryLog, setDateRecoveryLog]   = useState<RecoveryLog | null>(null);
  const [loadingDate, setLoadingDate]         = useState(false);

  const [bedtime, setBedtime]           = useState(SLEEP_FORM_DEFAULTS.bedtime);
  const [wakeup, setWakeup]             = useState(SLEEP_FORM_DEFAULTS.wakeup);
  const [quality, setQuality]           = useState<SleepQualityUi>('good');
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [deepH, setDeepH]               = useState('');
  const [deepM, setDeepM]               = useState('');
  const [notes, setNotes]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [noSleepModalVisible, setNoSleepModalVisible] = useState(false);
  const [qualityExpanded, setQualityExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded]     = useState(false);
  const [savedSource, setSavedSource]         = useState<RecoverySource | null>(null);
  const [manualMode, setManualMode]           = useState(false);
  const [sleepSegments, setSleepSegments]     = useState<SleepSegment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

  const navigateDate = useCallback((dir: -1 | 1) => {
    const next = offsetSleepDate(activeDate, dir);
    if (next > today) return;
    setActiveDate(next);
  }, [activeDate, today]);

  const hkSleep = useMemo(() => {
    const row = healthDataForSleepDate(dateHealthData, activeDate);
    return row && typeof row.sleep_hours === 'number' && row.sleep_hours > 0 ? row : null;
  }, [dateHealthData, activeDate]);

  const recoveryForDate = useMemo(
    () => recoveryLogForDate(dateRecoveryLog, activeDate),
    [dateRecoveryLog, activeDate],
  );

  const persistedManualLog = useMemo(
    () => isPersistedManualLog(savedSource, hkSleep ?? dateHealthData, activeDate),
    [savedSource, hkSleep, dateHealthData, activeDate],
  );

  useEffect(() => {
    let cancelled = false;
    setDateHealthData(null);
    setDateRecoveryLog(null);
    setLoadingDate(true);
    Promise.all([
      fetchHealthForDate(activeDate, false),
      fetchRecoveryByDate(activeDate, false),
    ])
      .then(([healthRow, recoveryRow]) => {
        if (cancelled) return;
        setDateHealthData(healthDataForSleepDate(healthRow, activeDate));
        setDateRecoveryLog(recoveryRow);
      })
      .catch(() => {
        if (!cancelled) {
          setDateHealthData(null);
          setDateRecoveryLog(null);
        }
      })
      .finally(() => { if (!cancelled) setLoadingDate(false); });
    return () => { cancelled = true; };
  }, [activeDate, fetchHealthForDate, fetchRecoveryByDate]);

  const isHealthKitView = useMemo(
    () => isHealthKitDisplayMode(hkSleep, persistedManualLog, manualMode),
    [hkSleep, persistedManualLog, manualMode],
  );

  useEffect(() => {
    setQualityExpanded(false);
    setNotesExpanded(false);
    setSavedSource(null);
    setManualMode(false);

    const initial = buildInitialFormFields(hkSleep, recoveryForDate);
    setBedtime(initial.bedtime);
    setWakeup(initial.wakeup);
    setDeepH(initial.deepH);
    setDeepM(initial.deepM);
    setNotes(initial.notes);

    // A previously-saved manual log keeps the quality it was stored with (it was
    // already derived from the sleep input at save time). For everything else the
    // derived-quality effect below fills it in from the entered bedtime/wake-up.
    if (recoveryForDate?.source === 'manual') {
      setQuality(initial.quality);
      setQualityScore(initial.qualityScore);
    } else {
      setQuality('good');
      setQualityScore(null);
    }
  }, [activeDate, hkSleep, recoveryForDate]);

  useEffect(() => {
    if (isToday && !loadingDate && health.isConnected && !hkSleep) {
      setNoSleepModalVisible(true);
    } else {
      setNoSleepModalVisible(false);
    }
  }, [isToday, loadingDate, hkSleep, health.isConnected]);

  useEffect(() => {
    setSleepSegments([]);
    setSegmentsLoading(false);
    if (!isHealthKitView) return;

    const cached = segmentCache.current.get(activeDate);
    if (cached?.length) {
      setSleepSegments(cached);
      return;
    }

    const hk = getHealthKitModule();
    if (!hk) return;

    setSegmentsLoading(true);
    let cancelled = false;
    readSleepSegmentsForNight(hk, activeDate).then((segs) => {
      if (!cancelled) {
        if (segs.length > 0) segmentCache.current.set(activeDate, segs);
        setSleepSegments(segs);
        setSegmentsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [activeDate, isHealthKitView]);

  const hours = useMemo(
    () => resolveHeroHours(isHealthKitView, hkSleep, bedtime, wakeup),
    [isHealthKitView, hkSleep, bedtime, wakeup],
  );

  const parsedDeepHours = useMemo(() => parseDeepSleepInput(deepH, deepM), [deepH, deepM]);

  const derivedSleepQuality = useMemo(
    () => deriveQualityFromForm(hours.rawHours ?? 0, parsedDeepHours),
    [hours.rawHours, parsedDeepHours],
  );

  // Manual sleep quality is always derived from the entered sleep (duration +
  // optional deep), never chosen by the user. Keep the editable form's quality
  // in sync with what they've entered. Skip HealthKit (scored separately) and
  // already-saved manual logs (read-only).
  useEffect(() => {
    if (isHealthKitView || persistedManualLog) return;
    if ((hours.rawHours ?? 0) <= 0) return;
    setQuality(derivedSleepQuality.quality);
    setQualityScore(derivedSleepQuality.score);
  }, [derivedSleepQuality, hours.rawHours, isHealthKitView, persistedManualLog]);

  const stageSummary = useMemo(
    () => computeStageSummary(sleepSegments, { sleep: P.sleep, water: P.water, fat: P.fat, carbs: P.carbs }),
    [sleepSegments, P.sleep, P.water, P.fat, P.carbs],
  );

  const hypnogram = useMemo(() => hypnogramWindow(hkSleep), [hkSleep]);

  const dateLabel = formatSleepNavDate(activeDate);

  const qualityDisplay = useMemo(() => {
    if (isHealthKitView && hkSleep) {
      const hkQ = deriveQualityFromHealthKit(hkSleep);
      return {
        quality:        hkQ.quality,
        qualityScore:   hkQ.score,
        sleepEfficiency: hkSleep.sleep_efficiency,
        readOnly:       true,
      };
    }
    // Already-saved manual log: show what was stored (derived at save time).
    if (persistedManualLog) {
      return {
        quality,
        qualityScore: qualityScore ?? derivedSleepQuality.score,
        sleepEfficiency: null,
        readOnly: true,
      };
    }
    // New manual entry: quality is computed from the entered sleep, not
    // user-selectable — always read-only.
    return {
      quality: derivedSleepQuality.quality,
      qualityScore: derivedSleepQuality.score,
      sleepEfficiency: null,
      readOnly: true,
    };
  }, [isHealthKitView, hkSleep, persistedManualLog, quality, qualityScore, derivedSleepQuality]);

  const view: SleepLogScreenViewModel = useMemo(() => ({
    activeDate,
    isToday,
    dateLabel,
    saveLabel: isToday ? 'Save sleep log' : `Save for ${dateLabel}`,
    noSleepModalDescription: `Apple Health didn't find any sleep data for ${dateLabel.toLowerCase()}. Enter your sleep time below to log it manually.`,
    hero: {
      bedtime,
      wakeup,
      hours,
      loading: !isHealthKitView && loadingDate && !hkSleep && !recoveryForDate,
    },
    stages: {
      visible: isHealthKitView && (segmentsLoading || hasHypnogramSegments(sleepSegments)),
      segmentsLoading,
      hasSegments: hasHypnogramSegments(sleepSegments),
      fullCycles: countRemCycles(sleepSegments),
      segments: sleepSegments,
      stageSummary,
      ...hypnogram,
    },
    isHealthKitView,
    showEditableFields: !isHealthKitView && !persistedManualLog,
    persistedManualLog,
    qualityDisplay,
    qualityExpanded,
    notes,
    notesExpanded,
    deepH,
    deepM,
    pickerVisible,
    saving,
    noSleepModalVisible,
  }), [
    activeDate, isToday, dateLabel, bedtime, wakeup, hours, loadingDate, hkSleep,
    recoveryForDate, segmentsLoading, sleepSegments, stageSummary, hypnogram,
    isHealthKitView, persistedManualLog, qualityDisplay, qualityExpanded, notes,
    notesExpanded, deepH, deepM, pickerVisible, saving, noSleepModalVisible,
  ]);

  const performSave = useCallback(async () => {
    setSaving(true);
    try {
      // Manual saves always persist the quality derived from the entered sleep
      // — never a user-picked value.
      const payload = buildSleepSavePayload({
        activeDate,
        isToday,
        bedtime,
        wakeup,
        deepH,
        deepM,
        quality: derivedSleepQuality.quality,
        qualityScore: derivedSleepQuality.score,
        derivedScore: derivedSleepQuality.score,
        notes,
        hours,
        hk: hkSleep,
      });

      if (payload.sleepH <= 0) {
        toast.error('Could not save', 'Set a valid bedtime and wake-up time.');
        return;
      }

      await logRecovery(payload.recoveryBody, { notifyListeners: true });

      try {
        await health.syncHealth(payload.healthBody);
      } catch {
        // POST /recovery/log already mirrors sleep into health_data.
      }

      if (isToday) {
        await health.refresh();
      } else {
        const [updatedHealth, updatedRecovery] = await Promise.all([
          fetchHealthForDate(activeDate, true),
          fetchRecoveryByDate(activeDate, true),
        ]);
        setDateHealthData(healthDataForSleepDate(updatedHealth, activeDate));
        setDateRecoveryLog(updatedRecovery);
      }
      await refreshRecovery({ force: true });

      posthog.capture('sleep_logged', {
        sleep_hours: payload.sleepH,
        quality: derivedSleepQuality.quality,
        source: 'manual',
        is_today: isToday,
      });

      setSavedSource('manual');
      toast.success('Sleep logged', payload.toastLabel);
    } catch (err) {
      toast.error('Could not save', 'Please try again');
      const e = err instanceof Error ? err : new Error(String(err));
      posthog.capture('$exception', {
        $exception_list: [{
          type: e.name,
          value: e.message,
          stacktrace: { type: 'raw', frames: e.stack ?? '' },
        }],
        $exception_source: 'sleep_logged',
      });
    } finally {
      setSaving(false);
    }
  }, [
    activeDate, bedtime, wakeup, deepH, deepM, derivedSleepQuality, fetchHealthForDate,
    fetchRecoveryByDate, health, hkSleep, hours, isToday, logRecovery, notes, posthog,
    refreshRecovery, toast,
  ]);

  const actions: SleepLogActions = useMemo(() => ({
    navigateDate,
    setQualityExpanded,
    setNotesExpanded,
    setDeepH,
    setDeepM,
    setNotes,
    setPickerVisible,
    confirmTimePicker: (b, w) => {
      setBedtime(b);
      setWakeup(w);
      setPickerVisible(false);
    },
    handleSave: () => { void performSave(); },
    setNoSleepModalVisible,
    enterManualMode: () => {
      setManualMode(true);
      setSleepSegments([]);
      setSegmentsLoading(false);
      setQualityScore(null);
      setQualityExpanded(true);
      setNoSleepModalVisible(false);
    },
  }), [navigateDate, performSave]);

  return { view, actions };
}
