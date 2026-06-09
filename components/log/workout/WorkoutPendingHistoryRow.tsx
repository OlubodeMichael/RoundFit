import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  APPLE_FITNESS_HEART_COLOR,
  fmtWorkoutDuration,
  formatWorkoutTimeRange,
  pendingWorkoutDurationMinutes,
} from '@/components/log/workout/workout-display';
import { getCardAccent, GradientCard } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';
import type { WorkoutImportReviewItem } from '@/services/workout-import';

export interface WorkoutPendingHistoryRowProps {
  item: WorkoutImportReviewItem;
  onPress: () => void;
}

function buildStatLine(item: WorkoutImportReviewItem): string {
  const parts: string[] = [];

  const calories = item.caloriesBurned;
  if (calories != null && calories > 0) {
    parts.push(`${Math.round(calories).toLocaleString()} kcal`);
  }

  const durationMins = pendingWorkoutDurationMinutes(item);
  if (durationMins > 0) {
    parts.push(fmtWorkoutDuration(durationMins));
  }

  if (item.avgHeartRate != null && item.avgHeartRate > 0) {
    parts.push(`${Math.round(item.avgHeartRate)} bpm`);
  }

  return parts.join(' · ');
}

export function WorkoutPendingHistoryRow({ item, onPress }: WorkoutPendingHistoryRowProps) {
  const P = usePalette();
  const accent = getCardAccent('workouts', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const statLine = buildStatLine(item);
  const timeLabel = formatWorkoutTimeRange(
    item.sample.startDate.toISOString(),
    item.sample.endDate.toISOString(),
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <GradientCard
        variant="workouts"
        palette={palette}
        layout="metric"
        corner="top-left"
        animated={false}
        style={styles.card}
        contentStyle={[styles.inner, { borderColor: accent.iconSoft }]}
      >
        <Ionicons name={item.catalogEntry.icon} size={26} color={accent.iconBg} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: P.text }]} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={[styles.sourceBadge, { backgroundColor: P.sunken }]}>
              <Ionicons name="heart" size={10} color={APPLE_FITNESS_HEART_COLOR} />
              <Text style={[styles.sourceText, { color: P.textFaint }]}>Apple Fitness</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            {statLine.length > 0 ? (
              <Text
                style={[styles.statLine, { color: P.textFaint }]}
                numberOfLines={1}
              >
                {statLine}
              </Text>
            ) : (
              <View />
            )}
            {timeLabel != null ? (
              <Text
                style={[styles.timeLabel, { color: P.textFaint }]}
                numberOfLines={2}
              >
                {timeLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </GradientCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  card: {
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sourceBadge: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statLine: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  timeLabel: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'right',
    lineHeight: 14,
    maxWidth: '42%',
  },
});
