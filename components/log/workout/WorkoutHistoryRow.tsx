import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Workout } from '@/context/workout-context';
import {
  formatHistoryDateLabel,
  WORKOUT_META,
} from '@/components/log/workout/workout-display';
import { getLocalDateString } from '@/utils/date';
import { getCardAccent, GradientCard } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

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
  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.other;
  const calories = Math.round(workout.calories_burned);
  const interactive = onPress != null;
  const dateLabel = formatHistoryDateLabel(dateKey, getLocalDateString());

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
        <Ionicons name={meta.icon} size={26} color={accent.iconBg} />

        <View style={styles.body}>
          <Text style={[styles.title, { color: P.text }]} numberOfLines={1}>
            {meta.label}
          </Text>
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
  title: {
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
