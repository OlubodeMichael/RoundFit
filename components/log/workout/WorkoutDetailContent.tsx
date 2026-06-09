import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  APPLE_FITNESS_HEART_COLOR,
  fmtWorkoutDuration,
  formatHistoryDateLabel,
  formatWorkoutDistance,
  formatWorkoutTimeRange,
  INTENSITY_LABEL,
  WORKOUT_META,
  workoutFooterLabel,
  workoutSourceLabel,
} from '@/components/log/workout/workout-display';
import type { Workout } from '@/context/workout-context';
import { usePalette } from '@/lib/log-theme';
import { getLocalDateString } from '@/utils/date';

export interface WorkoutDetailContentProps {
  workout: Workout;
  onEdit?: () => void;
  onDelete?: () => void;
}

interface DetailStatProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function DetailStat({ label, value, icon }: DetailStatProps) {
  const P = usePalette();
  return (
    <View style={[styles.statCell, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
      <Ionicons name={icon} size={14} color={P.workout} />
      <Text style={[styles.statLabel, { color: P.textFaint }]}>{label}</Text>
      <Text style={[styles.statValue, { color: P.text }]}>{value}</Text>
    </View>
  );
}

export function WorkoutDetailContent({ workout, onEdit, onDelete }: WorkoutDetailContentProps) {
  const P = usePalette();
  const meta = WORKOUT_META[workout.type] ?? WORKOUT_META.other;
  const sourceLabel = workoutSourceLabel(workout.source);
  const timeRange = formatWorkoutTimeRange(workout.started_at, workout.ended_at);
  const distance = formatWorkoutDistance(workout.distance, workout.distance_unit);
  const dateLabel = formatHistoryDateLabel(workout.date ?? getLocalDateString(), getLocalDateString());

  const exerciseGroups = new Map<string, typeof workout.sets>();
  for (const set of workout.sets ?? []) {
    const bucket = exerciseGroups.get(set.exercise) ?? [];
    bucket.push(set);
    exerciseGroups.set(set.exercise, bucket);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
        <View style={[styles.heroIcon, { backgroundColor: P.workoutSoft }]}>
          <Ionicons name={meta.icon} size={28} color={P.workout} />
        </View>
        <View style={styles.heroText}>
          <Text style={[styles.eyebrow, { color: P.textFaint }]}>{dateLabel.toUpperCase()}</Text>
          <Text style={[styles.title, { color: P.text }]}>{meta.label}</Text>
          {sourceLabel != null && (
            <View style={styles.sourceRow}>
              <Ionicons name="heart" size={13} color={APPLE_FITNESS_HEART_COLOR} />
              <Text style={[styles.sourceText, { color: P.textFaint }]}>{sourceLabel}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.statsGrid}>
        <DetailStat
          label="Duration"
          value={fmtWorkoutDuration(workout.duration_mins)}
          icon="time-outline"
        />
        <DetailStat
          label="Calories"
          value={`${Math.round(workout.calories_burned)} kcal`}
          icon="flame-outline"
        />
        {workout.avg_heart_rate != null && (
          <DetailStat
            label="Avg HR"
            value={`${Math.round(workout.avg_heart_rate)} bpm`}
            icon="heart-outline"
          />
        )}
        {workout.max_heart_rate != null && (
          <DetailStat
            label="Max HR"
            value={`${Math.round(workout.max_heart_rate)} bpm`}
            icon="pulse-outline"
          />
        )}
        {distance != null && (
          <DetailStat label="Distance" value={distance} icon="navigate-outline" />
        )}
        {workout.intensity != null && (
          <DetailStat
            label="Intensity"
            value={INTENSITY_LABEL[workout.intensity]}
            icon="speedometer-outline"
          />
        )}
      </View>

      {timeRange != null && (
        <View style={[styles.infoRow, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
          <Text style={[styles.infoLabel, { color: P.textFaint }]}>Time</Text>
          <Text style={[styles.infoValue, { color: P.text }]}>{timeRange}</Text>
        </View>
      )}

      {workout.notes ? (
        <View style={[styles.notesBox, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
          <Text style={[styles.infoLabel, { color: P.textFaint }]}>Notes</Text>
          <Text style={[styles.notesText, { color: P.text }]}>{workout.notes}</Text>
        </View>
      ) : null}

      {exerciseGroups.size > 0 && (
        <View style={styles.setsSection}>
          <Text style={[styles.sectionTitle, { color: P.textFaint }]}>Sets</Text>
          {Array.from(exerciseGroups.entries()).map(([exercise, sets]) => (
            <View
              key={exercise}
              style={[styles.exerciseCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}
            >
              <Text style={[styles.exerciseName, { color: P.text }]}>{exercise}</Text>
              {sets.map((set, index) => (
                <Text key={set.id} style={[styles.setLine, { color: P.textFaint }]}>
                  Set {index + 1}: {set.reps ?? '—'} reps
                  {set.weight != null && set.weight > 0 ? ` · ${set.weight} ${set.weight_unit}` : ''}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.footerNote, { color: P.textFaint }]}>
        {workoutFooterLabel(workout.source)}
      </Text>

      <View style={styles.actions}>
        {onEdit != null && (
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: P.sunken, borderColor: P.cardEdge },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="pencil-outline" size={16} color={P.text} />
            <Text style={[styles.actionText, { color: P.text }]}>Edit workout</Text>
          </Pressable>
        )}
        {onDelete != null && (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: P.sunken, borderColor: '#EF444433' },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete workout</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  sourceText: { fontSize: 12, fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCell: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2, textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { fontSize: 12, fontWeight: '700' },
  infoValue: { fontSize: 14, fontWeight: '700' },
  notesBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  notesText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  setsSection: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  exerciseCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  exerciseName: { fontSize: 15, fontWeight: '800' },
  setLine: { fontSize: 13, fontWeight: '500' },
  footerNote: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  actions: { gap: 10, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionText: { fontSize: 14, fontWeight: '700' },
});
