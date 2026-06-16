import type { ImageSourcePropType } from 'react-native';

// Rewards MVP badge catalogue — mirrors the backend source of truth in
// roundfit-backend/src/services/badgeEngine.ts. IDs must stay in sync.

export type BadgeCategory = 'starter' | 'streak' | 'consistency' | 'milestone' | 'sleep';

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
}

export const BADGE_CATALOGUE: BadgeDef[] = [
  { id: 'first_food_log',     name: 'Fuel Up',          description: 'You logged your first meal',                icon: '🍽️', category: 'starter' },
  { id: 'first_workout',      name: 'First Rep',        description: 'You completed your first workout',          icon: '🏋️', category: 'starter' },
  { id: 'streak_3',           name: 'Hat Trick',        description: '3 days of logging in a row',                icon: '🔥', category: 'streak' },
  { id: 'streak_7',           name: 'Week Warrior',     description: 'A full week without missing a day',         icon: '⚡', category: 'streak' },
  { id: 'streak_14',          name: 'Two Weeks Strong', description: 'Two weeks of showing up',                   icon: '💪', category: 'streak' },
  { id: 'streak_30',          name: 'Iron Habit',       description: 'A month of consistency',                    icon: '🏆', category: 'streak' },
  { id: 'active_days_5',      name: 'Showing Up',       description: 'Logged on 5 different days',                icon: '📅', category: 'consistency' },
  { id: 'active_days_30',     name: 'Committed',        description: 'Active on 30 different days',               icon: '🗓️', category: 'consistency' },
  { id: 'perfect_week',       name: 'Perfect Week',     description: 'Logged every day, Monday to Sunday',        icon: '✨', category: 'consistency' },
  { id: 'workout_10',         name: 'Double Digits',    description: '10 workouts and counting',                  icon: '🎯', category: 'milestone' },
  { id: 'food_logs_50',       name: 'Dialled In',       description: '50 meals logged',                           icon: '🥇', category: 'milestone' },
  { id: 'good_sleep_7',       name: 'Seven Stars',      description: '7 nights of good sleep',                    icon: '🌙', category: 'sleep' },
  { id: 'good_sleep_30',      name: 'Solid Rest',       description: '30 nights of good sleep',                   icon: '💤', category: 'sleep' },
  { id: 'good_sleep_streak_7',name: 'Week of Rest',     description: '7 nights of good sleep in a row',           icon: '⭐', category: 'sleep' },
];

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  starter:     'Firsts',
  streak:      'Streaks',
  consistency: 'Consistency',
  milestone:   'Milestones',
  sleep:       'Sleep',
};

// Transparent PNG artwork, one per badge at assets/badges/<id>.png.
// Metro needs static require() calls — add a line when a new asset lands.
export const BADGE_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  first_food_log:  require('@/assets/badges/first_food_log.png'),
  first_workout:   require('@/assets/badges/first_workout.png'),
  streak_3:        require('@/assets/badges/streak_3.png'),
  streak_7:        require('@/assets/badges/streak_7.png'),
  streak_14:       require('@/assets/badges/streak_14.png'),
  streak_30:       require('@/assets/badges/streak_30.png'),
  active_days_5:   require('@/assets/badges/active_days_5.png'),
  active_days_30:  require('@/assets/badges/active_days_30.png'),
  workout_10:      require('@/assets/badges/workout_10.png'),
  food_logs_50:    require('@/assets/badges/food_logs_50.png'),
  good_sleep_7:        require('@/assets/badges/good_sleep_7.png'),
  good_sleep_30:       require('@/assets/badges/good_sleep_30.png'),
  good_sleep_streak_7: require('@/assets/badges/good_sleep_streak_7.png'),
  // perfect_week: require('@/assets/badges/perfect_week.png'),
};

export function badgeImage(id: string): ImageSourcePropType | undefined {
  return BADGE_IMAGES[id];
}

export function badgeById(id: string): BadgeDef | undefined {
  return BADGE_CATALOGUE.find((b) => b.id === id);
}
