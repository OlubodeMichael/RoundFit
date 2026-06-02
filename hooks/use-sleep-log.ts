import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { usePostHog } from 'posthog-react-native';

import { useToast } from '@/components/ui/Toast';
import { useHealth } from '@/hooks/use-health';
import { useRecovery } from '@/hooks/use-recovery';
import type { HealthData } from '@/context/health-context';
import type { RecoverySource } from '@/context/recovery-context';
import type { SleepLogScreenViewModel } from '@/types/sleep-log';
import {
  getHealthKitModule,
  readSleepSegmentsForNight,
  type SleepSegment,
} from '@/utils/healthkit';
import { qualityPctFromUi, type SleepQualityUi } from '@/utils/sleep-quality';
import { formatSleepNavDate, localSleepDateString, offsetSleepDate } from '@/utils/sleep-date';
import {
  buildInitialFormFields,
  buildSleepSavePayload,
  computeStageSummary,
  countRemCycles,
  deriveQualityFromForm,
  deriveQualityFromHealthKit,
  hasHypnogramSegments,
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
  selectQuality: (q: SleepQualityUi) => void;
  handleSave: () => void;
  setNoSleepModalVisible: (v: boolean) => void;
  enterManualMode: () => void;
}

export function useSleepLog(): { view: SleepLogScreenViewModel; actions: SleepLogActions } {
  const P       = usePalette();
  const toast   = useToast();
  const health  = useHealth();
  const posthog = usePostHog();
  const { logRecovery, refresh: refreshRecovery, today: recoveryToday } = useRecovery();
  const { fetchForDate: fetchHealthForDate } = health;

  const today = localSleepDateString();
  const [activeDate, setActiveDate] = useState(today);
  const isToday = activeDate === today;

  const segmentCache   = useRef<Map<string, SleepSegment[]>>(new Map());
  const qualityUserSet = useRef(false);

  const [dateHealthData, setDateHealthData] = useState<HealthData | null>(null);
  const [loadingDate, setLoadingDate]       = useState(false);

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
    const hk = isToday ? health.today : dateHealthData;
    return hk && typeof hk.sleep_hours === 'number' && hk.sleep_hours > 0 ? hk : null;
  }, [isToday, health.today, dateHealthData]);

  const recoveryForDate = useMemo(
    () => recoveryLogForDate(recoveryToday, activeDate),
    [recoveryToday, activeDate],
  );

  const persistedManualLog = useMemo(
    () => isPersistedManualLog(savedSource, recoveryToday, activeDate),
    [savedSource, recoveryToday, activeDate],
  );

  useEffect(() => {
    if (isToday) {
      setDateHealthData(null);
      setLoadingDate(false);
      return;
    }
    let cancelled = false;
    setLoadingDate(true);
    fetchHealthForDate(activeDate, false)
      .then((data) => { if (!cancelled) setDateHealthData(data); })
      .catch(() => { if (!cancelled) setDateHealthData(null); })
      .finally(() => { if (!cancelled) setLoadingDate(false); });
    return () => { cancelled = true; };
  }, [activeDate, isToday, fetchHealthForDate]);

  const isHealthKitView = useMemo(
    () => isHealthKitDisplayMode(hkSleep, persistedManualLog, manualMode),
    [hkSleep, persistedManualLog, manualMode],
  );

  useEffect(() => {
    qualityUserSet.current = false;
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

    if (recoveryForDate?.source === 'manual') {
      qualityUserSet.current = true;
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

  useEffect(() => {
    if (isHealthKitView || qualityUserSet.current) return;
    if ((hours.rawHours ?? 0) <= 0) return;
    setQuality(derivedSleepQuality.quality);
    setQualityScore(derivedSleepQuality.score);
  }, [derivedSleepQuality, hours.rawHours, isHealthKitView]);

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
    return {
      quality,
      qualityScore: qualityScore ?? derivedSleepQuality.score,
      sleepEfficiency: null,
      readOnly: false,
    };
  }, [isHealthKitView, hkSleep, quality, qualityScore, derivedSleepQuality.score]);

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
      const payload = buildSleepSavePayload({
        activeDate,
        isToday,
        bedtime,
        wakeup,
        deepH,
        deepM,
        quality,
        qualityScore,
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
        const updated = await fetchHealthForDate(activeDate, true);
        setDateHealthData(updated);
      }
      await refreshRecovery({ force: true });

      posthog.capture('sleep_logged', {
        sleep_hours: payload.sleepH,
        quality,
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
    activeDate, bedtime, wakeup, deepH, deepM, derivedSleepQuality.score, fetchHealthForDate,
    health, hkSleep, hours, isToday, logRecovery, notes, posthog, quality, qualityScore,
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
    selectQuality: (q) => {
      qualityUserSet.current = true;
      setQuality(q);
      setQualityScore(qualityPctFromUi(q));
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
