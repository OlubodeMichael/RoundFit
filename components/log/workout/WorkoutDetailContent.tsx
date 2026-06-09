import { ScrollView, StyleSheet, Text } from 'react-native';

import {
  fmtWorkoutDuration,
  formatHistoryDateLabel,
  formatWorkoutDistance,
  formatWorkoutTimeRange,
  INTENSITY_LABEL,
  WORKOUT_META,
  workoutFooterLabel,
  workoutSourceLabel,
} from '@/components/log/workout/workout-display';
import {
  WorkoutDetailActions,
  WorkoutDetailFooterNote,
  WorkoutDetailHero,
  WorkoutDetailRows,
  WorkoutDetailSection,
  WorkoutExerciseBlock,
  WorkoutHighlightStrip,
  workoutDetailContentStyle,
} from '@/components/log/workout/WorkoutDetailUI';
import type { Workout } from '@/context/workout-context';
import { usePalette } from '@/lib/log-theme';
import { getLocalDateString } from '@/utils/date';

export interface WorkoutDetailContentProps {
  workout: Workout;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function WorkoutDetailContent({ workout, onEdit, onDelete }: WorkoutDetailContentProps) {
  const P = usePalette();
  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.other;
  const sourceLabel = workoutSourceLabel(workout.source);
  const timeRange = formatWorkoutTimeRange(workout.started_at, workout.ended_at);
  const distance = formatWorkoutDistance(workout.distance, workout.distance_unit);
  const dateLabel = formatHistoryDateLabel(
    workout.date ?? getLocalDateString(),
    getLocalDateString(),
  );

  const heroMeta = [dateLabel, timeRange].filter(Boolean).join(' · ');

  const exerciseGroups = new Map<string, typeof workout.sets>();
  for (const set of workout.sets ?? []) {
    const bucket = exerciseGroups.get(set.exercise) ?? [];
    bucket.push(set);
    exerciseGroups.set(set.exercise, bucket);
  }

  const detailRows = [
    workout.avg_heart_rate != null
      ? {
          icon: 'heart-outline' as const,
          label: 'Avg heart rate',
          value: `${Math.round(workout.avg_heart_rate)} bpm`,
        }
      : null,
    workout.max_heart_rate != null
      ? {
          icon: 'pulse-outline' as const,
          label: 'Max heart rate',
          value: `${Math.round(workout.max_heart_rate)} bpm`,
        }
      : null,
    distance != null
      ? { icon: 'navigate-outline' as const, label: 'Distance', value: distance }
      : null,
    workout.intensity != null
      ? {
          icon: 'speedometer-outline' as const,
          label: 'Intensity',
          value: INTENSITY_LABEL[workout.intensity],
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row != null);

  return (
    <ScrollView
      contentContainerStyle={workoutDetailContentStyle}
      showsVerticalScrollIndicator={false}
    >
      <WorkoutDetailHero
        icon={meta.icon}
        title={meta.label}
        meta={heroMeta || undefined}
        sourceLabel={sourceLabel}
      />

      <WorkoutHighlightStrip
        metrics={[
          {
            label: 'Duration',
            value: fmtWorkoutDuration(workout.duration_mins),
          },
          {
            label: 'Calories',
            value: Math.round(workout.calories_burned).toLocaleString(),
            unit: 'kcal',
          },
        ]}
      />

      <WorkoutDetailRows rows={detailRows} delay={120} />

      {workout.notes ? (
        <WorkoutDetailSection title="Notes" delay={160}>
          <Text style={[styles.notesText, { color: P.text }]}>{workout.notes}</Text>
        </WorkoutDetailSection>
      ) : null}

      {exerciseGroups.size > 0 ? (
        <WorkoutDetailSection title="Sets" delay={200}>
          {Array.from(exerciseGroups.entries()).map(([exercise, sets], index) => (
            <WorkoutExerciseBlock
              key={exercise}
              name={exercise}
              showDivider={index > 0}
              sets={sets.map((set, index) => ({
                id: set.id,
                index: index + 1,
                reps: set.reps != null ? String(set.reps) : '—',
                weight:
                  set.weight != null && set.weight > 0
                    ? `${set.weight} ${set.weight_unit}`
                    : undefined,
              }))}
            />
          ))}
        </WorkoutDetailSection>
      ) : null}

      <WorkoutDetailFooterNote>{workoutFooterLabel(workout.source)}</WorkoutDetailFooterNote>

      <WorkoutDetailActions onEdit={onEdit} onDelete={onDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  notesText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
});
