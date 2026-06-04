import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { WorkoutGrid } from '@/components/log/workout/WorkoutGrid';
import { WorkoutPendingCard } from '@/components/log/workout/WorkoutPendingCard';
import { formatHistoryDateLabel } from '@/components/log/workout/workout-display';
import type { PendingWorkoutGroup } from '@/hooks/use-pending-workout-imports';
import { usePalette } from '@/lib/log-theme';
import { getLocalDateString } from '@/utils/date';

export interface WorkoutPendingSectionProps {
  groups: PendingWorkoutGroup[];
  isLoading?: boolean;
  onOpenItem: (uuid: string) => void;
}

export function WorkoutPendingSection({
  groups,
  isLoading = false,
  onOpenItem,
}: WorkoutPendingSectionProps) {
  const P = usePalette();
  const todayKey = getLocalDateString();

  if (isLoading && groups.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={P.workout} />
        <Text style={[styles.loadingText, { color: P.textFaint }]}>
          Loading Apple Fitness workouts…
        </Text>
      </View>
    );
  }

  if (groups.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: P.textFaint }]}>Apple Fitness</Text>
      {groups.map((group) => (
        <View key={group.date} style={styles.group}>
          <Text style={[styles.dateLabel, { color: P.text }]}>
            {formatHistoryDateLabel(group.date, todayKey)}
          </Text>
          <WorkoutGrid>
            {group.items.map((item, index) => (
              <WorkoutPendingCard
                key={item.sample.uuid}
                item={item}
                delay={index * 60}
                onPress={() => onOpenItem(item.sample.uuid)}
              />
            ))}
          </WorkoutGrid>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  group: { gap: 8, marginBottom: 8 },
  dateLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  loading: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  loadingText: { fontSize: 13, fontWeight: '600' },
});
