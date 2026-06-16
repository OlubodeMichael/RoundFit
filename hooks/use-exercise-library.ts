import { useCallback, useEffect, useMemo, useState } from 'react';

import { EXERCISE_LIBRARY } from '@/components/log/workout/constants';
import type { ExerciseSection, WorkoutType } from '@/components/log/workout/types';
import {
  addCustomExercise as persistCustomExercise,
  loadCustomExercises,
  normalizeExerciseName,
  removeCustomExercise as persistRemoveCustomExercise,
  type CustomExerciseStore,
} from '@/utils/custom-exercises-storage';
import { filterExerciseSections, mergeExerciseLibrary } from '@/utils/merge-exercise-library';

interface UseExerciseLibraryResult {
  sections: ExerciseSection[];
  customNames: Set<string>;
  loaded: boolean;
  addCustomExercise: (
    name: string,
    category: string,
  ) => Promise<'added' | 'duplicate' | 'empty' | 'invalid'>;
  removeCustomExercise: (name: string) => Promise<void>;
}

export function useExerciseLibrary(
  workoutType: WorkoutType,
  search: string,
): UseExerciseLibraryResult {
  const [store, setStore] = useState<CustomExerciseStore | null>(null);

  useEffect(() => {
    let active = true;
    loadCustomExercises().then((data) => {
      if (active) setStore(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const customEntries = store?.[workoutType] ?? [];

  const mergedSections = useMemo(
    () => mergeExerciseLibrary(EXERCISE_LIBRARY[workoutType] ?? [], customEntries),
    [workoutType, customEntries],
  );

  const sections = useMemo(
    () => filterExerciseSections(mergedSections, search),
    [mergedSections, search],
  );

  const customNames = useMemo(
    () => new Set(customEntries.map((e) => e.name)),
    [customEntries],
  );

  const addCustomExercise = useCallback(
    async (
      name: string,
      category: string,
    ): Promise<'added' | 'duplicate' | 'empty' | 'invalid'> => {
      const normalized = normalizeExerciseName(name);
      const normalizedCategory = category.trim();
      if (!normalized) return 'empty';
      if (!normalizedCategory || normalizedCategory === 'all') return 'invalid';

      const builtIn = EXERCISE_LIBRARY[workoutType] ?? [];
      const inBuiltIn = builtIn.some((section) =>
        section.exercises.some((e) => e.toLowerCase() === normalized.toLowerCase()),
      );
      const inCustom = customEntries.some(
        (e) => e.name.toLowerCase() === normalized.toLowerCase(),
      );
      if (inBuiltIn || inCustom) return 'duplicate';

      const next = await persistCustomExercise(workoutType, normalized, normalizedCategory);
      setStore(next);
      return 'added';
    },
    [workoutType, customEntries],
  );

  const removeCustomExercise = useCallback(
    async (name: string) => {
      const next = await persistRemoveCustomExercise(workoutType, name);
      setStore(next);
    },
    [workoutType],
  );

  return {
    sections,
    customNames,
    loaded: store !== null,
    addCustomExercise,
    removeCustomExercise,
  };
}
