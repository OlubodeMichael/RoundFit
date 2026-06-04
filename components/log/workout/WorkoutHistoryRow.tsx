import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Workout } from '@/context/workout-context';
import {
  fmtWorkoutDuration,
  formatWorkoutDistance,
  formatWorkoutTimeRange,
  WORKOUT_META,
  workoutSourceLabel,
} from '@/components/log/workout/workout-display';
import { getCardAccent, GradientCard } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

export interface WorkoutHistoryRowProps {
  workout: Workout;
  onPress?: (workout: Workout) => void;
  delay?: number;
}

function buildMetaLine(workout: Workout): string {
  const parts: string[] = [fmtWorkoutDuration(workout.duration_mins)];

  const distance = formatWorkoutDistance(workout.distance, workout.distance_unit);
  if (distance != null) parts.push(distance);

  const setCount = workout.sets?.length ?? 0;
  if (setCount > 0) {
    parts.push(`${setCount} ${setCount === 1 ? 'set' : 'sets'}`);
  }

  const timeRange = formatWorkoutTimeRange(workout.started_at, workout.ended_at);
  if (timeRange != null) parts.push(timeRange);

  const sourceLabel = workoutSourceLabel(workout.source);
  if (sourceLabel != null) parts.push(sourceLabel);

  return parts.join(' · ');
}

export function WorkoutHistoryRow({ workout, onPress }: WorkoutHistoryRowProps) {
  const P = usePalette();
  const accent = getCardAccent('workouts', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.other;
  const metaLine = buildMetaLine(workout);
  const calories = Math.round(workout.calories_burned);
  const interactive = onPress != null;

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
        <View style={[styles.iconRing, { backgroundColor: accent.iconSoft }]}>
          <View style={[styles.iconBox, { backgroundColor: accent.iconBg }]}>
            <Ionicons name={meta.icon} size={18} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: P.text }]} numberOfLines={1}>
              {meta.label}
            </Text>
            {calories > 0 && (
              <View style={styles.calBlock}>
                <Text style={[styles.calValue, { color: P.text }]}>{calories}</Text>
                <Text style={[styles.calUnit, { color: P.textFaint }]}>kcal</Text>
              </View>
            )}
          </View>
          <Text style={[styles.meta, { color: P.textFaint }]} numberOfLines={2}>
            {metaLine}
          </Text>
        </View>

        {interactive && (
          <Ionicons name="chevron-forward" size={18} color={P.textFaint} />
        )}
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
  iconRing: {
    padding: 3,
    borderRadius: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  calBlock: {
    alignItems: 'flex-end',
  },
  calValue: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  calUnit: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: -1,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
