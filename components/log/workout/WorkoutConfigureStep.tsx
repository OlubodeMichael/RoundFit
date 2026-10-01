import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import { WorkoutCatalogIcon } from '@/components/log/workout/WorkoutCatalogIcon';
import { usePalette } from '@/lib/log-theme';
import type { WorkoutLauncherIntent } from '@/types/workout-session';

import { CALORIES_PER_MINUTE, INTENSITY_OPTIONS } from './constants';
import { ExercisePicker } from './ExercisePicker';
import {
  createExerciseSetDraft,
  ExerciseSetsEditorModal,
  type ExerciseSetDraft,
} from './ExerciseSetsEditorModal';
import { WorkoutDurationPicker } from './WorkoutDurationPicker';
import type { Intensity, WorkoutType } from './types';

export interface WorkoutConfigureStepProps {
  entry: WorkoutCatalogEntry;
  intent: WorkoutLauncherIntent;
  presetExercises: string[];
  onPresetExercisesChange: (exercises: string[]) => void;
  calorieGoalEnabled: boolean;
  onCalorieGoalEnabledChange: (enabled: boolean) => void;
  calorieGoalText: string;
  onCalorieGoalTextChange: (text: string) => void;
  logHours: string;
  onLogHoursChange: (value: string) => void;
  logMinutes: string;
  onLogMinutesChange: (value: string) => void;
  exerciseSets: Record<string, ExerciseSetDraft[]>;
  onExerciseSetsChange: (value: Record<string, ExerciseSetDraft[]>) => void;
  weightUnit: 'kg' | 'lb';
  logIntensity: Intensity;
  onLogIntensityChange: (value: Intensity) => void;
  logNotes: string;
  onLogNotesChange: (value: string) => void;
}

function catalogIdToPickerType(entry: WorkoutCatalogEntry): WorkoutType {
  const logIds: WorkoutType[] = ['strength', 'run', 'cardio', 'hiit', 'yoga', 'other'];
  if (logIds.includes(entry.id as WorkoutType)) return entry.id as WorkoutType;
  return entry.sessionMode === 'strength' ? 'strength' : 'cardio';
}

export function WorkoutConfigureStep(props: WorkoutConfigureStepProps) {
  const {
    entry,
    intent,
    presetExercises,
    onPresetExercisesChange,
    calorieGoalEnabled,
    onCalorieGoalEnabledChange,
    calorieGoalText,
    onCalorieGoalTextChange,
    logHours,
    onLogHoursChange,
    logMinutes,
    onLogMinutesChange,
    exerciseSets,
    onExerciseSetsChange,
    weightUnit,
    logIntensity,
    onLogIntensityChange,
    logNotes,
    onLogNotesChange,
  } = props;
  const P = usePalette();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(() => logNotes.length > 0);

  if (intent === 'log') {
    const isStrength = entry.sessionMode === 'strength';
    const totalMinutes =
      (parseInt(logHours, 10) || 0) * 60 + (parseInt(logMinutes, 10) || 0);
    const estimatedCals = Math.round(totalMinutes * CALORIES_PER_MINUTE[logIntensity]);

    return (
      <View style={styles.wrap}>
        <ActivitySummary entry={entry} />
        <WorkoutDurationPicker
          variant="configure"
          hours={logHours}
          minutes={logMinutes}
          onHoursChange={onLogHoursChange}
          onMinutesChange={onLogMinutesChange}
          estimatedCals={estimatedCals}
          totalMinutes={totalMinutes}
        />
        {isStrength && (
          <>
            <LogExerciseSection
              presetExercises={presetExercises}
              exerciseSets={exerciseSets}
              weightUnit={weightUnit}
              required
              onOpenPicker={() => setPickerOpen(true)}
              onEditExercise={setEditingExercise}
            />
          </>
        )}
        <LogIntensitySection
          intensity={logIntensity}
          onIntensityChange={onLogIntensityChange}
        />
        <LogNotesSection
          notes={logNotes}
          onNotesChange={onLogNotesChange}
          notesOpen={notesOpen}
          onNotesOpenChange={setNotesOpen}
        />
        <ExercisePicker
          visible={pickerOpen}
          workoutType={catalogIdToPickerType(entry)}
          mode="multi"
          value={presetExercises}
          title="Select exercises"
          onClose={() => setPickerOpen(false)}
          onConfirm={(exercises) => {
            onPresetExercisesChange(exercises);
            onExerciseSetsChange(
              Object.fromEntries(
                exercises.map((exercise) => [
                  exercise,
                  exerciseSets[exercise] ?? [createExerciseSetDraft()],
                ]),
              ),
            );
            setPickerOpen(false);
          }}
        />
        <ExerciseSetsEditorModal
          visible={editingExercise != null}
          exercise={editingExercise ?? ''}
          sets={editingExercise ? exerciseSets[editingExercise] ?? [] : []}
          weightUnit={weightUnit}
          onChange={(sets) => {
            if (!editingExercise) return;
            onExerciseSetsChange({ ...exerciseSets, [editingExercise]: sets });
          }}
          onClose={() => setEditingExercise(null)}
        />
      </View>
    );
  }

  if (intent !== 'live' && intent !== 'burn') {
    return (
      <Text style={[styles.hint, { color: P.textFaint }]}>
        Configuration for this intent is not available yet.
      </Text>
    );
  }

  const showStrengthExercises = intent === 'live' && entry.sessionMode === 'strength';
  const showCardioGoal = entry.sessionMode === 'cardio' || intent === 'burn';

  return (
    <View style={styles.wrap}>
      <ActivitySummary entry={entry} />
      {showStrengthExercises && (
        <StrengthExerciseSection
          presetExercises={presetExercises}
          onOpenPicker={() => setPickerOpen(true)}
          onClear={() => onPresetExercisesChange([])}
        />
      )}
      {showCardioGoal && (
        <CardioGoalSection
          enabled={calorieGoalEnabled}
          onEnabledChange={onCalorieGoalEnabledChange}
          goalText={calorieGoalText}
          onGoalTextChange={onCalorieGoalTextChange}
        />
      )}
      <ExercisePicker
        visible={pickerOpen}
        workoutType={catalogIdToPickerType(entry)}
        mode="multi"
        value={presetExercises}
        title="Exercises before start"
        onClose={() => setPickerOpen(false)}
        onConfirm={(exercises) => {
          onPresetExercisesChange(exercises);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

function ActivitySummary({ entry }: { entry: WorkoutCatalogEntry }) {
  const P = usePalette();
  return (
    <View style={[styles.summary, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <WorkoutCatalogIcon entry={entry} size={48} color={P.workout} weight="semibold" />
      <View style={styles.summaryText}>
        <Text style={[styles.summaryLabel, { color: P.textFaint }]}>Activity</Text>
        <Text style={[styles.summaryTitle, { color: P.text }]}>{entry.label}</Text>
      </View>
    </View>
  );
}

function LogExerciseSection({
  presetExercises,
  exerciseSets,
  weightUnit,
  required,
  onOpenPicker,
  onEditExercise,
}: {
  presetExercises: string[];
  exerciseSets: Record<string, ExerciseSetDraft[]>;
  weightUnit: 'kg' | 'lb';
  required?: boolean;
  onOpenPicker: () => void;
  onEditExercise: (exercise: string) => void;
}) {
  const P = usePalette();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeadingRow}>
        <Text style={[styles.sectionTitle, { color: P.text }]}>
          Exercises{required ? '' : ' (optional)'}
        </Text>
        {presetExercises.length > 0 && (
          <Pressable onPress={onOpenPicker} hitSlop={8}>
            <Text style={[styles.editLink, { color: P.workout }]}>Edit list</Text>
          </Pressable>
        )}
      </View>
      <Text style={[styles.hint, { color: P.textFaint }]}>
        {required ? 'Choose an exercise, then add its sets.' : 'Pick lifts before you start.'}
      </Text>
      {presetExercises.length > 0 && (
        <View style={[styles.exerciseList, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
          {presetExercises.map((name, index) => (
            <ExerciseOverviewRow
              key={name}
              name={name}
              index={index}
              sets={exerciseSets[name] ?? []}
              weightUnit={weightUnit}
              showDivider={index > 0}
              onPress={() => onEditExercise(name)}
            />
          ))}
        </View>
      )}
      <Pressable
        onPress={onOpenPicker}
        style={[styles.actionBtn, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}
      >
        <Ionicons name="barbell-outline" size={18} color={P.workout} />
        <Text style={[styles.actionBtnText, { color: P.text }]}>
          {presetExercises.length > 0 ? 'Add or remove exercises' : 'Choose exercises'}
        </Text>
      </Pressable>
    </View>
  );
}

function ExerciseOverviewRow({
  name,
  index,
  sets,
  weightUnit,
  showDivider,
  onPress,
}: {
  name: string;
  index: number;
  sets: ExerciseSetDraft[];
  weightUnit: 'kg' | 'lb';
  showDivider: boolean;
  onPress: () => void;
}) {
  const P = usePalette();
  const complete =
    sets.length > 0 &&
    sets.every((set) => {
      const reps = parseInt(set.reps, 10);
      const weight = parseFloat(set.weight);
      return Number.isFinite(reps) && reps > 0 && Number.isFinite(weight) && weight >= 0;
    });
  const preview = sets
    .filter((set) => set.reps !== '' || set.weight !== '')
    .slice(0, 3)
    .map((set) => `${set.reps || '–'} × ${set.weight || '–'} ${weightUnit}`)
    .join('  ·  ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit sets for ${name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.exerciseRow,
        showDivider && { borderTopColor: P.hair, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: P.sunken },
      ]}
    >
      <View style={[styles.exerciseNumber, { backgroundColor: P.workoutSoft }]}>
        <Text style={[styles.exerciseNumberText, { color: P.workout }]}>{index + 1}</Text>
      </View>
      <View style={styles.exerciseSummary}>
        <Text style={[styles.exerciseName, { color: P.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.exerciseMeta, { color: complete ? P.workout : P.textFaint }]} numberOfLines={1}>
          {preview || `${sets.length || 1} set${sets.length === 1 ? '' : 's'} · Add reps and weight`}
        </Text>
      </View>
      <View style={styles.exerciseStatus}>
        {complete && <Ionicons name="checkmark-circle" size={20} color={P.workout} />}
        <Ionicons name="chevron-forward" size={18} color={P.textFaint} />
      </View>
    </Pressable>
  );
}

function LogIntensitySection({
  intensity,
  onIntensityChange,
}: {
  intensity: Intensity;
  onIntensityChange: (value: Intensity) => void;
}) {
  const P = usePalette();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: P.text }]}>Intensity</Text>
      <View style={styles.intGrid}>
        {INTENSITY_OPTIONS.map((opt) => {
          const active = opt.id === intensity;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onIntensityChange(opt.id)}
              style={({ pressed }) => [
                styles.intCard,
                {
                  backgroundColor: active ? P.workout + '18' : P.card,
                  borderColor: active ? P.workout : P.cardEdge,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={styles.dotMeter}>
                {[1, 2, 3, 4].map((d) => (
                  <View
                    key={d}
                    style={[
                      styles.dotSeg,
                      {
                        backgroundColor:
                          d <= opt.dots
                            ? active
                              ? P.workout
                              : P.workout + '55'
                            : P.cardEdge,
                        height: 4 + d * 3,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.intLabel, { color: active ? P.workout : P.textDim }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LogNotesSection({
  notes,
  onNotesChange,
  notesOpen,
  onNotesOpenChange,
}: {
  notes: string;
  onNotesChange: (value: string) => void;
  notesOpen: boolean;
  onNotesOpenChange: (open: boolean) => void;
}) {
  const P = usePalette();
  return (
    <View style={styles.section}>
      <Pressable onPress={() => onNotesOpenChange(!notesOpen)} style={styles.notesToggle}>
        <Ionicons
          name={notesOpen ? 'chevron-down' : 'chevron-forward'}
          size={14}
          color={P.textFaint}
        />
        <Text style={[styles.notesToggleText, { color: P.textFaint }]}>Notes (optional)</Text>
        {notes.length > 0 && (
          <View style={[styles.notesDot, { backgroundColor: P.workout }]} />
        )}
      </Pressable>
      {notesOpen && (
        <View
          style={[styles.notesBox, { backgroundColor: P.card, borderColor: P.cardEdge }]}
        >
          <TextInput
            value={notes}
            onChangeText={onNotesChange}
            placeholder="PRs, form cues, how it felt…"
            placeholderTextColor={P.textFaint}
            multiline
            style={[styles.notesInput, { color: P.text }]}
          />
        </View>
      )}
    </View>
  );
}

function StrengthExerciseSection({
  presetExercises,
  onOpenPicker,
  onClear,
}: {
  presetExercises: string[];
  onOpenPicker: () => void;
  onClear: () => void;
}) {
  const P = usePalette();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: P.text }]}>Exercises (optional)</Text>
      <Text style={[styles.hint, { color: P.textFaint }]}>
        Pick lifts before you start, or add them during the session.
      </Text>
      {presetExercises.length > 0 && (
        <View style={styles.pillRow}>
          {presetExercises.map((name) => (
            <View
              key={name}
              style={[styles.pill, { backgroundColor: P.workoutSoft, borderColor: P.workout }]}
            >
              <Text style={[styles.pillText, { color: P.workout }]} numberOfLines={1}>
                {name}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Pressable
        onPress={onOpenPicker}
        style={[styles.actionBtn, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}
      >
        <Ionicons name="barbell-outline" size={18} color={P.workout} />
        <Text style={[styles.actionBtnText, { color: P.text }]}>
          {presetExercises.length > 0 ? 'Edit exercises' : 'Choose exercises'}
        </Text>
      </Pressable>
      {presetExercises.length > 0 && (
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={[styles.skipLink, { color: P.textFaint }]}>Clear selection</Text>
        </Pressable>
      )}
    </View>
  );
}

function CardioGoalSection({
  enabled,
  onEnabledChange,
  goalText,
  onGoalTextChange,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  goalText: string;
  onGoalTextChange: (v: string) => void;
}) {
  const P = usePalette();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: P.text }]}>Calorie goal (optional)</Text>
      <Text style={[styles.hint, { color: P.textFaint }]}>
        Set a target to track during the session, or skip to track freely.
      </Text>
      <Pressable onPress={() => onEnabledChange(!enabled)} style={styles.toggleRow}>
        <Text style={[styles.toggleLabel, { color: P.text }]}>Set a calorie target</Text>
        <View
          style={[
            styles.toggle,
            { backgroundColor: enabled ? P.workout : P.sunken, borderColor: P.cardEdge },
          ]}
        >
          <View style={[styles.toggleKnob, { transform: [{ translateX: enabled ? 18 : 2 }] }]} />
        </View>
      </Pressable>
      {enabled && (
        <View style={[styles.goalField, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
          <TextInput
            value={goalText}
            onChangeText={onGoalTextChange}
            placeholder="e.g. 300"
            placeholderTextColor={P.textFaint}
            keyboardType="number-pad"
            style={[styles.goalInput, { color: P.text }]}
          />
          <Text style={[styles.goalUnit, { color: P.textFaint }]}>kcal</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryText: { flex: 1 },
  summaryLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  summaryTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginTop: 2 },
  section: { gap: 10 },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  editLink: { fontSize: 13, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 19 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBtnText: { fontSize: 15, fontWeight: '700' },
  exerciseList: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  exerciseRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  exerciseNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberText: { fontSize: 11, fontWeight: '800' },
  exerciseSummary: { flex: 1, gap: 4 },
  exerciseName: { fontSize: 15, fontWeight: '800' },
  exerciseMeta: { fontSize: 12, fontWeight: '600' },
  exerciseStatus: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  skipLink: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  intGrid: { flexDirection: 'row', gap: 8 },
  intCard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 8,
  },
  dotMeter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 16,
  },
  dotSeg: { width: 6, borderRadius: 2 },
  intLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  notesToggleText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  notesDot: { width: 6, height: 6, borderRadius: 3 },
  notesBox: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    minHeight: 80,
  },
  notesInput: { fontSize: 14, fontWeight: '500', lineHeight: 21 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  goalField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  goalInput: { flex: 1, fontSize: 17, fontWeight: '700', paddingVertical: 10 },
  goalUnit: { fontSize: 14, fontWeight: '600' },
});
