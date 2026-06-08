import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { WorkoutCatalogEntry } from '@/config/workout-catalog';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type BurnTint = 'calories' | 'protein' | 'carbs' | 'fat' | 'water' | 'workout';

/** Legacy Home burn row shape — prefer `WorkoutCatalogEntry` for new code. */
export interface BurnActivityShape {
  id: string;
  label: string;
  verb: string;
  met: number;
  icon: IoniconName;
  tint: BurnTint;
}

const BURN_VERB_BY_ID: Record<string, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Cycle',
  swim: 'Swim',
  rowing: 'Row',
  hiit: 'HIIT',
  strength: 'Lift',
  hike: 'Hike',
  dance: 'Dance',
  yoga: 'Yoga',
  cardio: 'Cardio',
  other: 'Move',
};

const BURN_ICON_BY_ID: Record<string, IoniconName> = {
  walk: 'walk',
  run: 'speedometer',
  cycle: 'bicycle',
  swim: 'water',
  rowing: 'boat',
  hiit: 'flash',
  strength: 'barbell',
  hike: 'trail-sign',
  dance: 'musical-notes',
  yoga: 'leaf',
  cardio: 'heart',
  other: 'apps',
};

const BURN_TINT_BY_ID: Record<string, BurnTint> = {
  walk: 'calories',
  run: 'protein',
  cycle: 'workout',
  swim: 'water',
  rowing: 'fat',
  hiit: 'calories',
  strength: 'carbs',
  hike: 'carbs',
  dance: 'fat',
  yoga: 'protein',
  cardio: 'workout',
  other: 'calories',
};

export function computeDurationMinutes(met: number, weightKg: number, caloriesToBurn: number) {
  if (!isFinite(met) || met <= 0) return 0;
  if (!isFinite(weightKg) || weightKg <= 0) return 0;
  if (!isFinite(caloriesToBurn) || caloriesToBurn <= 0) return 0;
  const minutes = (caloriesToBurn / (met * weightKg)) * 60;
  return Math.max(5, Math.round(minutes / 5) * 5);
}

export function formatDurationLabel(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return h === 1 ? '1 hr' : `${h} hrs`;
  return `${h}h ${m}m`;
}

export function getBurnVerb(catalogId: string): string {
  return BURN_VERB_BY_ID[catalogId] ?? 'Move';
}

export function formatCatalogPrescription(entry: WorkoutCatalogEntry, minutes: number) {
  return `${getBurnVerb(entry.id)} ${formatDurationLabel(minutes)}`;
}

/** Map a catalogue entry to the legacy `BurnActivity` shape used by the cardio LA hook. */
export function catalogEntryToBurnActivity(entry: WorkoutCatalogEntry): BurnActivityShape {
  return {
    id: entry.id,
    label: entry.label,
    verb: getBurnVerb(entry.id),
    met: entry.met ?? 0,
    icon: BURN_ICON_BY_ID[entry.id] ?? entry.icon,
    tint: BURN_TINT_BY_ID[entry.id] ?? 'calories',
  };
}
