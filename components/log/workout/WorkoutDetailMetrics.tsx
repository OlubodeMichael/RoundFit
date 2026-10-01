import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';
import { AnimatedCard, FieldLabel, usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface WorkoutDetailRowProps {
  icon: IoniconName;
  label: string;
  value: string;
  accent?: string;
}

export function WorkoutDetailRows({
  rows,
  delay = 120,
}: {
  rows: WorkoutDetailRowProps[];
  delay?: number;
}) {
  const P = usePalette();
  if (rows.length === 0) return null;

  return (
    <View style={styles.pad}>
      <AnimatedCard delay={delay} padding={0}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[
              styles.row,
              index < rows.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: P.hair,
              },
            ]}
          >
            <View style={[styles.icon, { backgroundColor: P.workoutSoft }]}>
              <Ionicons name={row.icon} size={15} color={P.workout} />
            </View>
            <Text style={[styles.label, { color: P.textDim }]}>{row.label}</Text>
            <Text style={[styles.value, { color: row.accent ?? P.text }]}>{row.value}</Text>
          </View>
        ))}
      </AnimatedCard>
    </View>
  );
}

export function WorkoutDetailSection({
  title,
  children,
  delay = 180,
}: {
  title: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <View style={styles.pad}>
      <AnimatedCard delay={delay}>
        <FieldLabel>{title}</FieldLabel>
        <View style={styles.sectionBody}>{children}</View>
      </AnimatedCard>
    </View>
  );
}

export interface WorkoutSetLine {
  id: string;
  index: number;
  reps: string;
  weight?: string;
}

export function WorkoutExerciseBlock({
  name,
  sets,
  showDivider = false,
}: {
  name: string;
  sets: WorkoutSetLine[];
  showDivider?: boolean;
}) {
  const P = usePalette();

  return (
    <View
      style={[
        styles.exerciseBlock,
        showDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: P.hair,
          paddingTop: 10,
        },
      ]}
    >
      <View style={styles.exerciseHeading}>
        <Text style={[styles.exerciseName, { color: P.text }]}>{name}</Text>
        <View style={[styles.setCount, { backgroundColor: P.workoutSoft }]}>
          <Text style={[styles.setCountText, { color: P.workout }]}>
            {sets.length} {sets.length === 1 ? 'set' : 'sets'}
          </Text>
        </View>
      </View>
      <View style={styles.setColumns}>
        <Text style={[styles.setColumnSmall, { color: P.textFaint }]}>Set</Text>
        <Text style={[styles.setColumn, { color: P.textFaint }]}>Reps</Text>
        <Text style={[styles.setColumn, { color: P.textFaint }]}>Weight</Text>
      </View>
      {sets.map((set) => (
        <View key={set.id} style={[styles.setRow, { borderTopColor: P.hair }]}>
          <View style={[styles.setBadge, { backgroundColor: P.workoutSoft }]}>
            <Text style={[styles.setBadgeText, { color: P.workout }]}>{set.index}</Text>
          </View>
          <Text style={[styles.setValue, { color: P.text }]}>{set.reps}</Text>
          <Text style={[styles.setValue, { color: P.text }]}>{set.weight ?? '—'}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: WORKOUT_DETAIL_PAD, marginTop: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: 14, fontWeight: '600' },
  value: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  sectionBody: { marginTop: 14, gap: 18 },
  exerciseBlock: { gap: 0 },
  exerciseHeading: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
  },
  exerciseName: { flex: 1, fontSize: 17, fontWeight: '800', letterSpacing: -0.25 },
  setCount: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  setCountText: { fontSize: 11, fontWeight: '800' },
  setColumns: { flexDirection: 'row', alignItems: 'center', paddingBottom: 7 },
  setColumnSmall: {
    width: 46,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  setColumn: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  setRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  setBadgeText: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  setValue: { flex: 1, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
