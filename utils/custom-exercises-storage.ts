import AsyncStorage from '@react-native-async-storage/async-storage';

import { EXERCISE_LIBRARY } from '@/components/log/workout/constants';
import type { WorkoutType } from '@/components/log/workout/types';

const STORAGE_KEY_V2 = 'custom_exercises_v2';
const STORAGE_KEY_V1 = 'custom_exercises_v1';

export interface CustomExerciseEntry {
  name: string;
  category: string;
}

export type CustomExerciseStore = Record<WorkoutType, CustomExerciseEntry[]>;

const WORKOUT_TYPES: WorkoutType[] = ['strength', 'run', 'cardio', 'hiit', 'yoga', 'other'];

function emptyStore(): CustomExerciseStore {
  return {
    strength: [],
    run: [],
    cardio: [],
    hiit: [],
    yoga: [],
    other: [],
  };
}

function defaultCategoryForType(workoutType: WorkoutType): string {
  return EXERCISE_LIBRARY[workoutType]?.[0]?.category ?? 'Custom';
}

function normalizeEntry(raw: unknown): CustomExerciseEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = 'name' in raw && typeof raw.name === 'string' ? normalizeExerciseName(raw.name) : '';
  const category =
    'category' in raw && typeof raw.category === 'string' ? raw.category.trim() : '';
  if (!name || !category) return null;
  return { name, category };
}

function normalizeStore(raw: unknown): CustomExerciseStore {
  const base = emptyStore();
  if (!raw || typeof raw !== 'object') return base;

  for (const type of WORKOUT_TYPES) {
    const list = (raw as CustomExerciseStore)[type];
    if (!Array.isArray(list)) continue;

    const entries: CustomExerciseEntry[] = [];
    for (const item of list) {
      if (typeof item === 'string') {
        const name = normalizeExerciseName(item);
        if (name) entries.push({ name, category: defaultCategoryForType(type) });
        continue;
      }
      const entry = normalizeEntry(item);
      if (entry) entries.push(entry);
    }
    base[type] = entries;
  }
  return base;
}

async function migrateV1Store(): Promise<CustomExerciseStore | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return null;
    const migrated = normalizeStore(JSON.parse(raw));
    await AsyncStorage.setItem(STORAGE_KEY_V2, JSON.stringify(migrated));
    await AsyncStorage.removeItem(STORAGE_KEY_V1);
    return migrated;
  } catch {
    return null;
  }
}

export async function loadCustomExercises(): Promise<CustomExerciseStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_V2);
    if (raw) return normalizeStore(JSON.parse(raw));
    const migrated = await migrateV1Store();
    return migrated ?? emptyStore();
  } catch {
    return emptyStore();
  }
}

async function persistStore(store: CustomExerciseStore): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store));
}

export function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export async function addCustomExercise(
  workoutType: WorkoutType,
  name: string,
  category: string,
): Promise<CustomExerciseStore> {
  const normalized = normalizeExerciseName(name);
  const normalizedCategory = category.trim();
  if (!normalized || !normalizedCategory) return loadCustomExercises();

  const store = await loadCustomExercises();
  const existing = store[workoutType];
  const duplicate = existing.some((e) => e.name.toLowerCase() === normalized.toLowerCase());
  if (duplicate) return store;

  const next: CustomExerciseStore = {
    ...store,
    [workoutType]: [...existing, { name: normalized, category: normalizedCategory }],
  };
  await persistStore(next);
  return next;
}

export async function removeCustomExercise(
  workoutType: WorkoutType,
  name: string,
): Promise<CustomExerciseStore> {
  const store = await loadCustomExercises();
  const next: CustomExerciseStore = {
    ...store,
    [workoutType]: store[workoutType].filter(
      (e) => e.name.toLowerCase() !== name.toLowerCase(),
    ),
  };
  await persistStore(next);
  return next;
}
