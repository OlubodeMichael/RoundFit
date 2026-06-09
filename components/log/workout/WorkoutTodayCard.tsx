import type { WorkoutListStat } from '@/components/log/workout/WorkoutListCard';
import { WorkoutListCard } from '@/components/log/workout/WorkoutListCard';
import {
  formatWorkoutTimeRange,
  WORKOUT_META,
  workoutSourceLabel,
} from '@/components/log/workout/workout-display';
import { getCatalogEntryForBackendType } from '@/config/workout-catalog';
import type { Workout } from '@/context/workout-context';
import { formatHealthKitWorkoutDurationHms } from '@/utils/healthkit';

export interface WorkoutTodayCardProps {
  workout: Workout;
  onPress: () => void;
  delay?: number;
}

function buildStats(workout: Workout): WorkoutListStat[] {
  const stats: WorkoutListStat[] = [
    {
      label: 'Duration',
      value: formatHealthKitWorkoutDurationHms(workout.duration_mins * 60),
    },
  ];

  if (workout.avg_heart_rate != null && workout.avg_heart_rate > 0) {
    stats.push({
      label: 'Avg HR',
      value: `${Math.round(workout.avg_heart_rate)} bpm`,
    });
  }

  return stats;
}

export function WorkoutTodayCard({ workout, onPress, delay = 0 }: WorkoutTodayCardProps) {
  const catalogEntry = getCatalogEntryForBackendType(workout.type);
  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.other;
  const icon = catalogEntry?.icon ?? meta.icon;
  const title = catalogEntry?.label ?? meta.label;
  const timeRange = formatWorkoutTimeRange(workout.started_at, workout.ended_at);
  const sourceLabel = workoutSourceLabel(workout.source);

  return (
    <WorkoutListCard
      icon={icon}
      title={title}
      timeRange={timeRange}
      eyebrow={sourceLabel}
      stats={buildStats(workout)}
      calories={workout.calories_burned}
      delay={delay}
      onPress={onPress}
    />
  );
}
