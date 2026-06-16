import type { WorkoutListStat } from '@/components/log/workout/WorkoutListCard';
import { WorkoutListCard } from '@/components/log/workout/WorkoutListCard';
import {
  formatWorkoutTimeRange,
  workoutSourceLabel,
} from '@/components/log/workout/workout-display';
import type { Workout } from '@/context/workout-context';
import { formatHealthKitWorkoutDurationHms } from '@/utils/healthkit';
import { useWorkoutCatalogDisplay } from '@/hooks/use-workout-catalog-display';

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
  const { label, iconEntry } = useWorkoutCatalogDisplay(workout);
  const timeRange = formatWorkoutTimeRange(workout.started_at, workout.ended_at);
  const sourceLabel = workoutSourceLabel(workout.source);

  return (
    <WorkoutListCard
      iconEntry={iconEntry}
      title={label}
      timeRange={timeRange}
      eyebrow={sourceLabel}
      stats={buildStats(workout)}
      calories={workout.calories_burned}
      delay={delay}
      onPress={onPress}
    />
  );
}
