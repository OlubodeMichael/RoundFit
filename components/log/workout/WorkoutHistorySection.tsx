import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { WorkoutHistoryRow } from '@/components/log/workout/WorkoutHistoryRow';
import { formatHistoryDateLabel } from '@/components/log/workout/workout-display';
import type { Workout } from '@/context/workout-context';
import type { WorkoutHistoryGroup } from '@/hooks/use-workout-history';
import { usePalette } from '@/lib/log-theme';
import { getLocalDateString } from '@/utils/date';

export interface WorkoutHistorySectionProps {
  groups: WorkoutHistoryGroup[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onEditWorkout?: (workout: Workout) => void;
}

export function WorkoutHistorySection({
  groups,
  isLoading,
  error,
  onRetry,
  onEditWorkout,
}: WorkoutHistorySectionProps) {
  const P = usePalette();
  const todayKey = getLocalDateString();
  const hasHistory = groups.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: P.textFaint }]}>History</Text>

      {isLoading && !hasHistory ? (
        <View style={styles.center}>
          <ActivityIndicator color={P.workout} />
        </View>
      ) : error != null && !hasHistory ? (
        <View style={[styles.empty, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
          <Text style={[styles.emptyText, { color: P.textFaint }]}>{error}</Text>
          <Pressable onPress={onRetry} style={[styles.retryBtn, { backgroundColor: P.sunken }]}>
            <Text style={[styles.retryText, { color: P.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : !hasHistory ? (
        <View style={[styles.empty, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
          <Text style={[styles.emptyText, { color: P.textFaint }]}>
            Past workouts from Apple Fitness and your log will show up here.
          </Text>
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.date} style={styles.group}>
            <Text style={[styles.dateLabel, { color: P.text }]}>
              {formatHistoryDateLabel(group.date, todayKey)}
            </Text>
            <View style={styles.list}>
              {group.workouts.map((workout) => (
                <WorkoutHistoryRow
                  key={workout.id}
                  workout={workout}
                  onPress={onEditWorkout}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, gap: 10 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  group: { gap: 2 },
  list: { gap: 8 },
  dateLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 8, letterSpacing: 0.2 },
  center: { paddingVertical: 24, alignItems: 'center' },
  empty: {
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  emptyText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryText: { fontSize: 13, fontWeight: '700' },
});
