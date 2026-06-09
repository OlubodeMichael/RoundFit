import { StyleSheet, Text, View } from 'react-native';

import { WorkoutGrid } from '@/components/log/workout/WorkoutGrid';
import { WorkoutPendingCard } from '@/components/log/workout/WorkoutPendingCard';
import { WorkoutTodayCard } from '@/components/log/workout/WorkoutTodayCard';
import type { Workout } from '@/context/workout-context';
import { usePalette } from '@/lib/log-theme';
import type { WorkoutImportReviewItem } from '@/services/workout-import';

export interface WorkoutTodaySectionProps {
  pendingItems: WorkoutImportReviewItem[];
  workouts: Workout[];
  onOpenPending: (uuid: string) => void;
  onOpenWorkout: (workout: Workout) => void;
}

export function WorkoutTodaySection({
  pendingItems,
  workouts,
  onOpenPending,
  onOpenWorkout,
}: WorkoutTodaySectionProps) {
  const P = usePalette();
  const hasContent = pendingItems.length > 0 || workouts.length > 0;

  if (!hasContent) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: P.textFaint }]}>Today</Text>
      <WorkoutGrid>
        {pendingItems.map((item, index) => (
          <WorkoutPendingCard
            key={item.sample.uuid}
            item={item}
            delay={index * 60}
            onPress={() => onOpenPending(item.sample.uuid)}
          />
        ))}
        {workouts.map((workout, index) => (
          <WorkoutTodayCard
            key={workout.id}
            workout={workout}
            delay={(pendingItems.length + index) * 60}
            onPress={() => onOpenWorkout(workout)}
          />
        ))}
      </WorkoutGrid>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
