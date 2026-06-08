import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { SleepQualityUi } from '@/utils/sleep-quality';
import type { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type Palette = ReturnType<typeof usePalette>;

export const SLEEP_QUALITY_OPTIONS: {
  id: SleepQualityUi;
  label: string;
  icon: IoniconName;
}[] = [
  { id: 'poor',  label: 'Poor',  icon: 'cloud-outline'        },
  { id: 'fair',  label: 'Fair',  icon: 'partly-sunny-outline' },
  { id: 'good',  label: 'Good',  icon: 'sunny-outline'        },
  { id: 'great', label: 'Great', icon: 'sparkles-outline'     },
];

export function sleepQualityPillColor(P: Palette, q: SleepQualityUi): string {
  if (q === 'great') return P.protein;
  if (q === 'good')  return P.sleep;
  if (q === 'fair')  return P.carbs;
  return P.danger;
}

export function sleepQualityRingColor(P: Palette, q: SleepQualityUi): string {
  if (q === 'great' || q === 'good') return P.protein;
  if (q === 'fair') return P.carbs;
  return P.danger;
}
