import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { muscleGroupBannerByCategory } from '@/constants/muscle-group-banners';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface ExerciseCategoryAppearance {
  icon: IoniconName;
  accent: string;
  gradient: readonly [string, string];
  subtitle: string;
}

const DEFAULT_APPEARANCE: ExerciseCategoryAppearance = {
  icon: 'fitness-outline',
  accent: '#22D3EE',
  gradient: ['#1A2E3A', '#0E7490'],
  subtitle: 'Exercises',
};

const EXERCISE_CATEGORY_APPEARANCE: Readonly<Record<string, ExerciseCategoryAppearance>> = {
  Easy: {
    icon: 'walk-outline',
    accent: '#38BDF8',
    gradient: ['#1E3A5F', '#0E7490'],
    subtitle: 'Recovery pace',
  },
  Distance: {
    icon: 'flag-outline',
    accent: '#818CF8',
    gradient: ['#1E1B4B', '#4338CA'],
    subtitle: 'Race & endurance',
  },
  Speed: {
    icon: 'flash-outline',
    accent: '#F472B6',
    gradient: ['#3B1538', '#BE185D'],
    subtitle: 'Intervals & tempo',
  },
  Terrain: {
    icon: 'trail-sign-outline',
    accent: '#34D399',
    gradient: ['#14261F', '#047857'],
    subtitle: 'Trail & track',
  },
  Machine: {
    icon: 'hardware-chip-outline',
    accent: '#22D3EE',
    gradient: ['#1A2E3A', '#0E7490'],
    subtitle: 'Indoor cardio',
  },
  Outdoor: {
    icon: 'sunny-outline',
    accent: '#FBBF24',
    gradient: ['#3B2F14', '#B45309'],
    subtitle: 'Fresh air sessions',
  },
  Sport: {
    icon: 'basketball-outline',
    accent: '#F97316',
    gradient: ['#3B1F0F', '#C2410C'],
    subtitle: 'Court & field',
  },
  'Low Impact': {
    icon: 'water-outline',
    accent: '#60A5FA',
    gradient: ['#172554', '#1D4ED8'],
    subtitle: 'Gentle movement',
  },
  Plyometric: {
    icon: 'arrow-up-outline',
    accent: '#EF4444',
    gradient: ['#3B1010', '#B91C1C'],
    subtitle: 'Explosive power',
  },
  'Full Body': {
    icon: 'body-outline',
    accent: '#F97316',
    gradient: ['#3B1F0F', '#C2410C'],
    subtitle: 'Total-body burn',
  },
  'Cardio Bursts': {
    icon: 'pulse-outline',
    accent: '#EC4899',
    gradient: ['#3B1538', '#BE185D'],
    subtitle: 'High-energy rounds',
  },
  'Core HIIT': {
    icon: 'shield-outline',
    accent: '#2DD4BF',
    gradient: ['#1A2E2A', '#0F766E'],
    subtitle: 'Abs & stability',
  },
  'Upper Body': {
    icon: 'barbell-outline',
    accent: '#A78BFA',
    gradient: ['#2A2438', '#6D28D9'],
    subtitle: 'Push & pull',
  },
  Standing: {
    icon: 'person-outline',
    accent: '#C084FC',
    gradient: ['#2A2438', '#7C3AED'],
    subtitle: 'Grounded poses',
  },
  Floor: {
    icon: 'bed-outline',
    accent: '#86EFAC',
    gradient: ['#14261F', '#15803D'],
    subtitle: 'Mat work',
  },
  Balance: {
    icon: 'leaf-outline',
    accent: '#67E8F9',
    gradient: ['#164E63', '#0891B2'],
    subtitle: 'Stability & focus',
  },
  Flow: {
    icon: 'infinite-outline',
    accent: '#F472B6',
    gradient: ['#3B1538', '#BE185D'],
    subtitle: 'Linked sequences',
  },
  Functional: {
    icon: 'construct-outline',
    accent: '#FBBF24',
    gradient: ['#3B2F14', '#B45309'],
    subtitle: 'Mixed modalities',
  },
  'Flexibility & Recovery': {
    icon: 'medkit-outline',
    accent: '#34D399',
    gradient: ['#14261F', '#047857'],
    subtitle: 'Restore & mobilize',
  },
  'Sport & Activity': {
    icon: 'trophy-outline',
    accent: '#FB923C',
    gradient: ['#3B1F0F', '#C2410C'],
    subtitle: 'Skills & play',
  },
  'Mindful Movement': {
    icon: 'flower-outline',
    accent: '#A78BFA',
    gradient: ['#2A2438', '#6D28D9'],
    subtitle: 'Breath & awareness',
  },
};

export function getExerciseCategoryAppearance(category: string): ExerciseCategoryAppearance {
  const muscle = muscleGroupBannerByCategory(category);
  if (muscle) {
    return {
      icon: muscle.icon,
      accent: muscle.accent,
      gradient: muscle.gradient,
      subtitle: muscle.subtitle,
    };
  }

  const key = Object.keys(EXERCISE_CATEGORY_APPEARANCE).find(
    (entry) => entry.toLowerCase() === category.toLowerCase(),
  );
  if (key) return EXERCISE_CATEGORY_APPEARANCE[key];

  return DEFAULT_APPEARANCE;
}
