import type { SleepQualityUi } from '@/utils/sleep-quality';
import type { SleepHoursResult } from '@/utils/sleep-time';
import type { SleepSegment } from '@/utils/healthkit';

export interface SleepStageSummaryRow {
  label: string;
  ms: number;
  pct: number;
  color: string;
}

/** Editable sleep log form fields. */
export interface SleepFormFields {
  bedtime: string;
  wakeup: string;
  deepH: string;
  deepM: string;
  quality: SleepQualityUi;
  qualityScore: number | null;
  notes: string;
}

export interface SleepLogHeroView {
  bedtime: string;
  wakeup: string;
  hours: SleepHoursResult;
  loading: boolean;
}

export interface SleepLogStagesView {
  visible: boolean;
  segmentsLoading: boolean;
  hasSegments: boolean;
  fullCycles: number;
  segments: SleepSegment[];
  stageSummary: SleepStageSummaryRow[];
  windowStart?: Date;
  windowEnd?: Date;
}

export interface SleepLogQualityView {
  quality: SleepQualityUi;
  qualityScore: number | null;
  sleepEfficiency: number | null;
  readOnly: boolean;
}

export interface SleepLogScreenViewModel {
  activeDate: string;
  isToday: boolean;
  dateLabel: string;
  saveLabel: string;
  noSleepModalDescription: string;
  hero: SleepLogHeroView;
  stages: SleepLogStagesView;
  /** Apple Health read-only experience (banner, stages, auto-saved footer). */
  isHealthKitView: boolean;
  showEditableFields: boolean;
  persistedManualLog: boolean;
  qualityDisplay: SleepLogQualityView;
  qualityExpanded: boolean;
  notes: string;
  notesExpanded: boolean;
  deepH: string;
  deepM: string;
  pickerVisible: boolean;
  saving: boolean;
  noSleepModalVisible: boolean;
}
