import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Workout } from '@/context/workout-context';
import {
  APPLE_FITNESS_HEART_COLOR,
  formatHistoryDateLabel,
  workoutSourceLabel,
} from '@/components/log/workout/workout-display';
import { WorkoutActivityIcon } from '@/components/log/workout/WorkoutActivityIcon';
import { getLocalDateString } from '@/utils/date';
import { getCardAccent, GradientCard } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';
import { useWorkoutCatalogDisplay } from '@/hooks/use-workout-catalog-display';

export interface WorkoutHistoryRowProps {
  workout: Workout;
  /** Local calendar day `YYYY-MM-DD` for the right-side date label. */
  dateKey: string;
  onPress?: (workout: Workout) => void;
  delay?: number;
}

export function WorkoutHistoryRow({ workout, dateKey, onPress }: WorkoutHistoryRowProps) {
  const P = usePalette();
  const accent = getCardAccent('workouts', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const { label, iconEntry } = useWorkoutCatalogDisplay(workout);
  const calories = Math.round(workout.calories_burned);
  const interactive = onPress != null;
  const dateLabel = formatHistoryDateLabel(dateKey, getLocalDateString());
  const sourceLabel = workoutSourceLabel(workout.source);

  return (
    <Pressable
      onPress={interactive ? () => onPress(workout) : undefined}
      disabled={!interactive}
      style={({ pressed }) => [styles.wrap, interactive && pressed && styles.pressed]}
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
        <WorkoutActivityIcon entry={iconEntry} />

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: P.text }]} numberOfLines={1}>
              {label}
            </Text>
            {sourceLabel != null ? (
              <View style={[styles.sourceBadge, { backgroundColor: P.sunken }]}>
                <Ionicons name="heart" size={10} color={APPLE_FITNESS_HEART_COLOR} />
                <Text style={[styles.sourceText, { color: P.textFaint }]}>{sourceLabel}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <View style={styles.calRow}>
              <Text style={[styles.calValue, { color: P.text }]}>
                {calories.toLocaleString()}
              </Text>
              <Text style={[styles.calUnit, { color: P.textFaint }]}>kcal</Text>
            </View>
            <Text
              style={[styles.dateLabel, { color: P.textFaint }]}
              numberOfLines={2}
            >
              {dateLabel}
            </Text>
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
  calRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexShrink: 0,
  },
  calValue: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  calUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateLabel: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'right',
    lineHeight: 14,
  },
});
