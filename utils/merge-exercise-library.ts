import type { ExerciseSection } from '@/components/log/workout/types';
import type { CustomExerciseEntry } from '@/utils/custom-exercises-storage';

export function mergeExerciseLibrary(
  builtIn: ExerciseSection[],
  customEntries: CustomExerciseEntry[] | undefined,
): ExerciseSection[] {
  if (!customEntries?.length) return builtIn;

  const result = builtIn.map((section) => ({
    category: section.category,
    exercises: [...section.exercises],
  }));
  const knownNames = new Set(
    builtIn.flatMap((section) => section.exercises.map((e) => e.toLowerCase())),
  );

  for (const entry of customEntries) {
    const name = entry.name.trim();
    const category = entry.category.trim();
    if (!name || !category) continue;
    if (knownNames.has(name.toLowerCase())) continue;
    knownNames.add(name.toLowerCase());

    const section = result.find((s) => s.category === category);
    if (section) {
      section.exercises.push(name);
    } else {
      result.push({ category, exercises: [name] });
    }
  }

  return result;
}

export function filterExerciseSections(
  sections: ExerciseSection[],
  search: string,
): ExerciseSection[] {
  const q = search.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((section) => ({
      category: section.category,
      exercises: section.exercises.filter((e) => e.toLowerCase().includes(q)),
    }))
    .filter((section) => section.exercises.length > 0);
}
