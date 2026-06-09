import { StyleSheet, Text, View } from 'react-native';

import { WorkoutPendingHistoryRow } from '@/components/log/workout/WorkoutPendingHistoryRow';
import { formatHistoryDateLabel } from '@/components/log/workout/workout-display';
import type { PendingWorkoutGroup } from '@/hooks/use-pending-workout-imports';
import { usePalette } from '@/lib/log-theme';
import { getLocalDateString } from '@/utils/date';

export interface WorkoutPendingSectionProps {
  /** Apple Fitness imports from days before today. */
  groups: PendingWorkoutGroup[];
  onOpenItem: (uuid: string) => void;
}

export function WorkoutPendingSection({
  groups,
  onOpenItem,
}: WorkoutPendingSectionProps) {
  const P = usePalette();
  const todayKey = getLocalDateString();

  if (groups.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {groups.map((group) => (
        <View key={group.date} style={styles.group}>
          <Text style={[styles.dateLabel, { color: P.text }]}>
            {formatHistoryDateLabel(group.date, todayKey)}
          </Text>
          <View style={styles.historyList}>
            {group.items.map((item) => (
              <WorkoutPendingHistoryRow
                key={item.sample.uuid}
                item={item}
                onPress={() => onOpenItem(item.sample.uuid)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, gap: 8 },
  group: { gap: 8, marginBottom: 8 },
  historyList: { gap: 8 },
  dateLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
});
