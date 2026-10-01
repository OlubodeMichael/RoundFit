import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppModal } from '@/components/ui/AppModal';
import { usePalette } from '@/lib/log-theme';

export interface ExerciseSetDraft {
  id: string;
  reps: string;
  weight: string;
}

interface ExerciseSetsEditorModalProps {
  visible: boolean;
  exercise: string;
  sets: ExerciseSetDraft[];
  weightUnit: 'kg' | 'lb';
  onChange: (sets: ExerciseSetDraft[]) => void;
  onClose: () => void;
}

let nextSetId = 0;

export function createExerciseSetDraft(): ExerciseSetDraft {
  nextSetId += 1;
  return { id: `set-${Date.now()}-${nextSetId}`, reps: '', weight: '' };
}

function cleanDecimal(value: string): string {
  return value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
}

export function ExerciseSetsEditorModal({
  visible,
  exercise,
  sets,
  weightUnit,
  onChange,
  onClose,
}: ExerciseSetsEditorModalProps) {
  const P = usePalette();

  const updateSet = (id: string, field: 'reps' | 'weight', value: string) => {
    onChange(sets.map((set) => (set.id === id ? { ...set, [field]: value } : set)));
  };

  const removeSet = (id: string) => {
    if (sets.length === 1) return;
    onChange(sets.filter((set) => set.id !== id));
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      sheetHeight={0.72}
      openAnimation="ease"
      dismissGestureArea="handle"
      keyboardAvoiding
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: P.workout }]}>EDIT SETS</Text>
            <Text style={[styles.headerTitle, { color: P.text }]} numberOfLines={2}>
              {exercise}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close set editor"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: P.sunken },
              pressed && { opacity: 0.65 },
            ]}
          >
            <Ionicons name="close" size={17} color={P.textDim} />
          </Pressable>
        </View>

        <View style={styles.sectionIntro}>
          <View style={[styles.iconCircle, { backgroundColor: P.workoutSoft }]}>
            <Ionicons name="barbell-outline" size={20} color={P.workout} />
          </View>
          <Text style={[styles.subtitle, { color: P.textFaint }]}>
            Record each set separately. Use 0 {weightUnit} for bodyweight.
          </Text>
        </View>

          <View style={styles.columnLabels}>
            <Text style={[styles.setColumnLabel, { color: P.textFaint }]}>Set</Text>
            <Text style={[styles.metricColumnLabel, { color: P.textFaint }]}>Reps</Text>
            <Text style={[styles.metricColumnLabel, { color: P.textFaint }]}>Weight</Text>
            <View style={styles.removeColumn} />
          </View>

          <View style={[styles.setList, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            {sets.map((set, index) => (
              <View
                key={set.id}
                style={[
                  styles.setRow,
                  index > 0 && { borderTopColor: P.hair, borderTopWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={[styles.setNumber, { backgroundColor: P.workoutSoft }]}>
                  <Text style={[styles.setNumberText, { color: P.workout }]}>{index + 1}</Text>
                </View>
                <MetricInput
                  value={set.reps}
                  unit="reps"
                  keyboardType="number-pad"
                  accessibilityLabel={`${exercise}, set ${index + 1}, reps`}
                  onChange={(value) => updateSet(set.id, 'reps', value.replace(/[^0-9]/g, ''))}
                />
                <MetricInput
                  value={set.weight}
                  unit={weightUnit}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`${exercise}, set ${index + 1}, weight in ${weightUnit}`}
                  onChange={(value) => updateSet(set.id, 'weight', cleanDecimal(value))}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove set ${index + 1}`}
                  accessibilityState={{ disabled: sets.length === 1 }}
                  disabled={sets.length === 1}
                  onPress={() => removeSet(set.id)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.removeButton,
                    { opacity: sets.length === 1 ? 0.2 : pressed ? 0.5 : 1 },
                  ]}
                >
                  <Ionicons name="remove-circle-outline" size={21} color={P.textFaint} />
                </Pressable>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add set"
            onPress={() => onChange([...sets, createExerciseSetDraft()])}
            style={({ pressed }) => [
              styles.addSetButton,
              { backgroundColor: P.workoutSoft },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="add" size={19} color={P.workout} />
            <Text style={[styles.addSetText, { color: P.workout }]}>Add set</Text>
          </Pressable>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: P.hair }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done editing sets"
          onPress={onClose}
          style={({ pressed }) => [
            styles.doneButton,
            { backgroundColor: P.workout },
            pressed && { opacity: 0.82 },
          ]}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </AppModal>
  );
}

function MetricInput({
  value,
  unit,
  keyboardType,
  accessibilityLabel,
  onChange,
}: {
  value: string;
  unit: string;
  keyboardType: 'number-pad' | 'decimal-pad';
  accessibilityLabel: string;
  onChange: (value: string) => void;
}) {
  const P = usePalette();
  return (
    <View style={[styles.metricInputWrap, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={P.textFaint}
        keyboardType={keyboardType}
        returnKeyType="done"
        selectTextOnFocus
        accessibilityLabel={accessibilityLabel}
        style={[styles.metricInput, { color: P.text }]}
      />
      <Text style={[styles.unit, { color: P.textFaint }]}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 20, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 4,
  },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 4 },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sectionIntro: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  columnLabels: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  setColumnLabel: { width: 34, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  metricColumnLabel: { flex: 1, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  removeColumn: { width: 24 },
  setList: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  setNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricInputWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
  },
  metricInput: {
    flex: 1,
    minWidth: 28,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 10, fontWeight: '700' },
  removeButton: { width: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addSetButton: {
    minHeight: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  addSetText: { fontSize: 15, fontWeight: '800' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
});
