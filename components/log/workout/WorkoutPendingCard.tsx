import type { WorkoutListStat } from '@/components/log/workout/WorkoutListCard';
import { WorkoutListCard } from '@/components/log/workout/WorkoutListCard';
import type { WorkoutImportReviewItem } from '@/services/workout-import';
import { formatHealthKitWorkoutDurationHms } from '@/utils/healthkit';
import { formatWorkoutTimeRange } from '@/components/log/workout/workout-display';

export interface WorkoutPendingCardProps {
  item: WorkoutImportReviewItem;
  onPress: () => void;
  delay?: number;
}

function buildStats(item: WorkoutImportReviewItem): WorkoutListStat[] {
  const stats: WorkoutListStat[] = [
    {
      label: 'Duration',
      value: formatHealthKitWorkoutDurationHms(item.sample.durationSeconds),
    },
  ];

  if (item.avgHeartRate != null && item.avgHeartRate > 0) {
    stats.push({
      label: 'Avg HR',
      value: `${Math.round(item.avgHeartRate)} bpm`,
    });
  }

  return stats;
}

export function WorkoutPendingCard({ item, onPress, delay = 0 }: WorkoutPendingCardProps) {
  const timeRange = formatWorkoutTimeRange(
    item.sample.startDate.toISOString(),
    item.sample.endDate.toISOString(),
  );

  return (
    <WorkoutListCard
      icon={item.catalogEntry.icon}
      title={item.label}
      timeRange={timeRange}
      eyebrow="Apple Fitness"
      stats={buildStats(item)}
      calories={item.caloriesBurned}
      isNew
      delay={delay}
      onPress={onPress}
    />
  );
}
