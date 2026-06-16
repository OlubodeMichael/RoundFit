import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { WorkoutType as UiWorkoutTypeId } from '@/components/log/workout/types';
import type { WorkoutType as BackendWorkoutType } from '@/context/workout-context';
import { getHealthKitActivityIcon } from '@/constants/healthkit-activity-icons';
import { getHealthKitActivityDisplayLabel } from '@/constants/healthkit-activity-types';

export { getHealthKitActivityDisplayLabel } from '@/constants/healthkit-activity-types';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];
export type SessionMode = 'strength' | 'cardio';

/** Stable ids used by Log live session, Log past form, and Home burn picker. */
export const LOG_WORKOUT_TYPE_IDS = [
  'strength',
  'run',
  'cardio',
  'hiit',
  'yoga',
  'other',
] as const satisfies readonly UiWorkoutTypeId[];

export interface WorkoutCatalogEntry {
  id: string;
  label: string;
  icon: IoniconName;
  sfSymbol: string;
  backendType: BackendWorkoutType;
  sessionMode: SessionMode;
  met?: number;
  supportsSets: boolean;
  healthKitActivityType?: string;
}

const WORKOUT_CATALOG: WorkoutCatalogEntry[] = [
  {
    id: 'strength',
    label: 'Strength',
    icon: 'barbell',
    sfSymbol: 'figure.strengthtraining.traditional',
    backendType: 'gym',
    sessionMode: 'strength',
    met: 6.0,
    supportsSets: true,
    healthKitActivityType: 'HKWorkoutActivityTypeTraditionalStrengthTraining',
  },
  {
    id: 'run',
    label: 'Running',
    icon: 'fitness',
    sfSymbol: 'figure.run',
    backendType: 'running',
    sessionMode: 'cardio',
    met: 8.0,
    supportsSets: true,
    healthKitActivityType: 'HKWorkoutActivityTypeRunning',
  },
  {
    id: 'cardio',
    label: 'Cardio',
    icon: 'pulse',
    sfSymbol: 'figure.mixed.cardio',
    backendType: 'cycling',
    sessionMode: 'cardio',
    supportsSets: true,
    healthKitActivityType: 'HKWorkoutActivityTypeCycling',
  },
  {
    id: 'hiit',
    label: 'HIIT',
    icon: 'flash',
    sfSymbol: 'figure.highintensity.intervaltraining',
    backendType: 'hiit',
    sessionMode: 'cardio',
    met: 9.0,
    supportsSets: true,
    healthKitActivityType: 'HKWorkoutActivityTypeHighIntensityIntervalTraining',
  },
  {
    id: 'yoga',
    label: 'Yoga',
    icon: 'body',
    sfSymbol: 'figure.yoga',
    backendType: 'yoga',
    sessionMode: 'cardio',
    met: 3.0,
    supportsSets: true,
    healthKitActivityType: 'HKWorkoutActivityTypeYoga',
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'ellipsis-horizontal-circle',
    sfSymbol: 'figure.mixed.cardio',
    backendType: 'other',
    sessionMode: 'cardio',
    supportsSets: true,
    healthKitActivityType: 'HKWorkoutActivityTypeOther',
  },
  {
    id: 'walk',
    label: 'Walking (brisk)',
    icon: 'walk',
    sfSymbol: 'figure.walk',
    backendType: 'walking',
    sessionMode: 'cardio',
    met: 4.3,
    supportsSets: false,
    healthKitActivityType: 'HKWorkoutActivityTypeWalking',
  },
  {
    id: 'cycle',
    label: 'Cycling',
    icon: 'bicycle',
    sfSymbol: 'figure.outdoor.cycle',
    backendType: 'cycling',
    sessionMode: 'cardio',
    met: 7.5,
    supportsSets: false,
    healthKitActivityType: 'HKWorkoutActivityTypeCycling',
  },
  {
    id: 'swim',
    label: 'Swimming',
    icon: 'water',
    sfSymbol: 'figure.pool.swim',
    backendType: 'swimming',
    sessionMode: 'cardio',
    met: 7.0,
    supportsSets: false,
    healthKitActivityType: 'HKWorkoutActivityTypeSwimming',
  },
  {
    id: 'rowing',
    label: 'Rowing',
    icon: 'boat',
    sfSymbol: 'figure.outdoor.rowing',
    backendType: 'rowing',
    sessionMode: 'cardio',
    met: 7.0,
    supportsSets: false,
    healthKitActivityType: 'HKWorkoutActivityTypeRowing',
  },
  {
    id: 'hike',
    label: 'Hiking',
    icon: 'trail-sign',
    sfSymbol: 'figure.hiking',
    backendType: 'walking',
    sessionMode: 'cardio',
    met: 6.0,
    supportsSets: false,
    healthKitActivityType: 'HKWorkoutActivityTypeHiking',
  },
  {
    id: 'dance',
    label: 'Dancing',
    icon: 'musical-notes',
    sfSymbol: 'figure.dance',
    backendType: 'other',
    sessionMode: 'cardio',
    met: 5.0,
    supportsSets: false,
    healthKitActivityType: 'HKWorkoutActivityTypeSocialDance',
  },
  {
    id: 'jump-rope',
    label: 'Jump Rope',
    icon: 'fitness-outline',
    sfSymbol: 'figure.jumprope',
    backendType: 'hiit',
    sessionMode: 'cardio',
    met: 9.0,
    supportsSets: false,
    healthKitActivityType: 'HKWorkoutActivityTypeJumpRope',
  },
];

const CATALOG_BY_ID = new Map(WORKOUT_CATALOG.map((entry) => [entry.id, entry]));

/** Full unified catalogue (Log types + Home burn activities). */
export const WORKOUT_CATALOG_ENTRIES: readonly WorkoutCatalogEntry[] = WORKOUT_CATALOG;

/** Log live / past picker types — backward-compatible shape for `constants.ts`. */
export const WORKOUT_TYPES: {
  id: UiWorkoutTypeId;
  label: string;
  icon: IoniconName;
}[] = LOG_WORKOUT_TYPE_IDS.map((id) => {
  const entry = CATALOG_BY_ID.get(id);
  if (!entry) {
    throw new Error(`Missing catalog entry for log workout type: ${id}`);
  }
  return { id: id as UiWorkoutTypeId, label: entry.label, icon: entry.icon };
});

export function getCatalogEntryById(id: string): WorkoutCatalogEntry | undefined {
  return CATALOG_BY_ID.get(id);
}

export function getCatalogEntriesByMode(mode: SessionMode): WorkoutCatalogEntry[] {
  return WORKOUT_CATALOG.filter((entry) => entry.sessionMode === mode);
}

/** Catalogue entries with MET values (Home burn prescription). */
export function getBurnCatalogEntries(): WorkoutCatalogEntry[] {
  return WORKOUT_CATALOG.filter((entry) => entry.met != null);
}

/** UI id → backend type (replaces scattered `UI_WORKOUT_TYPE_MAP` lookups). */
export function getBackendTypeForCatalogId(id: string): BackendWorkoutType | undefined {
  return getCatalogEntryById(id)?.backendType;
}

export function getCatalogEntryForBackendType(
  type: BackendWorkoutType,
): WorkoutCatalogEntry | undefined {
  return WORKOUT_CATALOG_ENTRIES.find((entry) => entry.backendType === type);
}

/** HK WorkoutActivityType raw values → best-matching catalogue id for import review. */
const HK_ACTIVITY_CATALOG_ID: Record<number, string> = {
  13: 'cycle',
  16: 'other',
  20: 'strength',
  24: 'hike',
  35: 'rowing',
  37: 'run',
  46: 'swim',
  50: 'strength',
  52: 'walk',
  57: 'yoga',
  63: 'hiit',
  64: 'jump-rope',
};

export function getCatalogIdForHealthKitActivity(activityType: number): string {
  return HK_ACTIVITY_CATALOG_ID[activityType] ?? 'other';
}

export function getCatalogEntryForHealthKitActivity(activityType: number): WorkoutCatalogEntry {
  const id = getCatalogIdForHealthKitActivity(activityType);
  const base = getCatalogEntryById(id) ?? getCatalogEntryById('other')!;
  const hkIcon = getHealthKitActivityIcon(activityType);
  const label = getHealthKitActivityDisplayLabel(activityType);

  return {
    ...base,
    label,
    icon: hkIcon.icon,
    sfSymbol: hkIcon.sfSymbol,
  };
}
