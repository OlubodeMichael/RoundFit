import { WorkoutCatalogIcon } from '@/components/log/workout/WorkoutCatalogIcon';
import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import { usePalette } from '@/lib/log-theme';

export const WORKOUT_ACTIVITY_ICON_SIZE = {
  log: 28,
  hero: 34,
} as const;

export interface WorkoutActivityIconProps {
  entry: Pick<WorkoutCatalogEntry, 'icon' | 'sfSymbol'>;
  /** Pixel size — defaults by variant when omitted. */
  size?: number;
  variant?: keyof typeof WORKOUT_ACTIVITY_ICON_SIZE;
}

/** Shared workout activity icon — matches Apple Fitness detail styling. */
export function WorkoutActivityIcon({
  entry,
  size,
  variant = 'log',
}: WorkoutActivityIconProps) {
  const P = usePalette();

  return (
    <WorkoutCatalogIcon
      entry={entry}
      size={size ?? WORKOUT_ACTIVITY_ICON_SIZE[variant]}
      color={P.calories}
      weight="bold"
    />
  );
}
