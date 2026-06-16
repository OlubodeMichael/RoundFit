import type { Workout } from '@/context/workout-context';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';
import { computeInferredSoreness, computeStepsBaseline } from '@/utils/infer-soreness';

function session(
  daysAgo: number,
  mins: number,
  intensity: 'light' | 'moderate' | 'hard' = 'moderate',
  type: Workout['type'] = 'gym',
): Workout {
  const date = addLocalCalendarDays(getLocalDateString(), -daysAgo);
  return {
    id:              `w-${daysAgo}`,
    type,
    duration_mins:   mins,
    calories_burned: 0,
    source:          'manual',
    intensity,
    distance_unit:   'km',
    created_at:      `${date}T12:00:00.000Z`,
    date,
    sets:            [],
  };
}

describe('computeStepsBaseline', () => {
  it('returns the mean of positive step counts', () => {
    expect(computeStepsBaseline([8000, 10000, 6000])).toBe(8000);
    expect(computeStepsBaseline([])).toBeNull();
  });
});

describe('computeInferredSoreness', () => {
  it('returns baseline soreness with no workouts or excess steps', () => {
    expect(computeInferredSoreness({
      workouts: [],
      stepDays: [],
      avgDailySteps: 7000,
    })).toBe(1);
  });

  it('weights yesterday harder than today for DOMS', () => {
    const yesterdayOnly = computeInferredSoreness({
      workouts: [session(1, 60, 'hard')],
      stepDays: [],
      avgDailySteps: 7000,
    });
    const todayOnly = computeInferredSoreness({
      workouts: [session(0, 60, 'hard')],
      stepDays: [],
      avgDailySteps: 7000,
    });
    expect(yesterdayOnly).toBeGreaterThan(todayOnly);
  });

  it('accumulates load across multiple recent sessions', () => {
    const oneDay = computeInferredSoreness({
      workouts: [session(1, 45, 'moderate')],
      stepDays: [],
      avgDailySteps: 7000,
    });
    const threeDays = computeInferredSoreness({
      workouts: [
        session(1, 45, 'moderate'),
        session(2, 45, 'moderate'),
        session(3, 45, 'moderate'),
      ],
      stepDays: [],
      avgDailySteps: 7000,
    });
    expect(threeDays).toBeGreaterThan(oneDay);
  });

  it('adds soreness from steps above the personal baseline', () => {
    const withSteps = computeInferredSoreness({
      workouts: [],
      stepDays: [{ date: addLocalCalendarDays(getLocalDateString(), -1), steps: 18000 }],
      avgDailySteps: 7000,
    });
    const without = computeInferredSoreness({
      workouts: [],
      stepDays: [{ date: addLocalCalendarDays(getLocalDateString(), -1), steps: 7000 }],
      avgDailySteps: 7000,
    });
    expect(withSteps).toBeGreaterThan(without);
  });

  it('applies eccentric factor for strength-style sessions', () => {
    const gym = computeInferredSoreness({
      workouts: [session(1, 60, 'moderate', 'gym')],
      stepDays: [],
      avgDailySteps: 7000,
    });
    const swim = computeInferredSoreness({
      workouts: [session(1, 60, 'moderate', 'swimming')],
      stepDays: [],
      avgDailySteps: 7000,
    });
    expect(gym).toBeGreaterThan(swim);
  });
});
