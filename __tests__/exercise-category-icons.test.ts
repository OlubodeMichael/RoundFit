import { getExerciseCategoryAppearance } from '@/constants/exercise-category-icons';

describe('exercise category icons', () => {
  it('returns muscle-group icons for strength categories', () => {
    const chest = getExerciseCategoryAppearance('Chest');
    expect(chest.icon).toBe('barbell-outline');
    expect(chest.accent).toBeTruthy();
  });

  it('returns dedicated icons for cardio and run categories', () => {
    expect(getExerciseCategoryAppearance('Machine').icon).toBe('hardware-chip-outline');
    expect(getExerciseCategoryAppearance('Easy').icon).toBe('walk-outline');
    expect(getExerciseCategoryAppearance('Flow').icon).toBe('infinite-outline');
  });

  it('falls back for unknown categories', () => {
    const fallback = getExerciseCategoryAppearance('Unknown Category');
    expect(fallback.icon).toBe('fitness-outline');
  });
});
