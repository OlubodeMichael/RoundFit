import { filterExerciseSections, mergeExerciseLibrary } from '@/utils/merge-exercise-library';

describe('mergeExerciseLibrary', () => {
  const builtIn = [
    { category: 'Chest', exercises: ['Bench Press'] },
    { category: 'Back', exercises: ['Deadlift'] },
  ];

  it('returns built-in library when no custom exercises', () => {
    expect(mergeExerciseLibrary(builtIn, [])).toEqual(builtIn);
  });

  it('appends custom exercises to their category section', () => {
    const merged = mergeExerciseLibrary(builtIn, [
      { name: 'Landmine twist', category: 'Chest' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].exercises).toEqual(['Bench Press', 'Landmine twist']);
  });

  it('skips custom names that duplicate built-in exercises', () => {
    const merged = mergeExerciseLibrary(builtIn, [
      { name: 'bench press', category: 'Chest' },
      { name: 'My Move', category: 'Back' },
    ]);
    expect(merged[0].exercises).toEqual(['Bench Press']);
    expect(merged[1].exercises).toEqual(['Deadlift', 'My Move']);
  });

  it('creates a section when category does not exist in built-in library', () => {
    const merged = mergeExerciseLibrary(builtIn, [
      { name: 'Custom WOD', category: 'Functional' },
    ]);
    expect(merged).toHaveLength(3);
    expect(merged[2]).toEqual({ category: 'Functional', exercises: ['Custom WOD'] });
  });
});

describe('filterExerciseSections', () => {
  const sections = [
    { category: 'Chest', exercises: ['Bench Press', 'Fly'] },
    { category: 'Back', exercises: ['Deadlift'] },
  ];

  it('filters exercises by search query', () => {
    const filtered = filterExerciseSections(sections, 'bench');
    expect(filtered).toEqual([
      { category: 'Chest', exercises: ['Bench Press'] },
    ]);
  });
});
