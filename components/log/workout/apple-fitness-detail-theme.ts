import type { Palette } from '@/lib/log-theme';

import { APPLE_FITNESS_HEART_COLOR } from '@/components/log/workout/workout-display';

export const APPLE_FITNESS_PINK = APPLE_FITNESS_HEART_COLOR;

export function appleFitnessHeroGradient(isDark: boolean): readonly [string, string, string] {
  return isDark
    ? ['rgba(34,211,238,0.14)', 'rgba(255,45,85,0.08)', 'transparent']
    : ['rgba(8,145,178,0.10)', 'rgba(255,45,85,0.05)', 'transparent'];
}

export function appleFitnessMetricAccent(
  kind: 'calories' | 'heart',
  P: Palette,
): { color: string; soft: string } {
  if (kind === 'heart') {
    return { color: P.danger, soft: P.dangerSoft };
  }
  return { color: P.calories, soft: P.caloriesSoft };
}

export function splitWorkoutDuration(totalSeconds: number): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const sec = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: Math.floor(sec / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
  };
}
