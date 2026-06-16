import type { ComponentProps } from 'react';
import type { ImageSourcePropType } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

/** Matches `data/muscle-group-banners.json` — keep IDs and categories in sync. */
export interface MuscleGroupBannerDef {
  id: string;
  category: string;
  label: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  gradient: readonly [string, string];
  accent: string;
}

export const MUSCLE_GROUP_BANNERS: MuscleGroupBannerDef[] = [
  {
    id: 'chest',
    category: 'Chest',
    label: 'Chest',
    subtitle: 'Push & press',
    icon: 'barbell-outline',
    gradient: ['#1A3A4A', '#0891B2'],
    accent: '#22D3EE',
  },
  {
    id: 'back',
    category: 'Back',
    label: 'Back',
    subtitle: 'Pull & row',
    icon: 'fitness-outline',
    gradient: ['#1E2F3D', '#0E7490'],
    accent: '#38BDF8',
  },
  {
    id: 'legs',
    category: 'Legs',
    label: 'Legs',
    subtitle: 'Squat & hinge',
    icon: 'walk-outline',
    gradient: ['#1F2933', '#047857'],
    accent: '#34D399',
  },
  {
    id: 'shoulders',
    category: 'Shoulders',
    label: 'Shoulders',
    subtitle: 'Press & raise',
    icon: 'body-outline',
    gradient: ['#2A2438', '#6D28D9'],
    accent: '#A78BFA',
  },
  {
    id: 'arms',
    category: 'Arms',
    label: 'Arms',
    subtitle: 'Curl & extend',
    icon: 'hand-left-outline',
    gradient: ['#2C1F1F', '#B45309'],
    accent: '#FBBF24',
  },
  {
    id: 'core',
    category: 'Core',
    label: 'Core',
    subtitle: 'Stability & control',
    icon: 'shield-outline',
    gradient: ['#1A2E2A', '#0F766E'],
    accent: '#2DD4BF',
  },
];

// Metro needs static require() calls — add a line when a banner PNG lands.
export const MUSCLE_GROUP_BANNER_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  // chest:      require('@/assets/workout/banners/chest.png'),
  // back:       require('@/assets/workout/banners/back.png'),
  // legs:       require('@/assets/workout/banners/legs.png'),
  // shoulders:  require('@/assets/workout/banners/shoulders.png'),
  // arms:       require('@/assets/workout/banners/arms.png'),
  // core:       require('@/assets/workout/banners/core.png'),
};

export function muscleGroupBannerByCategory(
  category: string,
): MuscleGroupBannerDef | undefined {
  return MUSCLE_GROUP_BANNERS.find(
    (b) => b.category.toLowerCase() === category.toLowerCase(),
  );
}

export function muscleGroupBannerImage(id: string): ImageSourcePropType | undefined {
  return MUSCLE_GROUP_BANNER_IMAGES[id];
}
