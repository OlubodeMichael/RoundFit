import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

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
      <Text style={[styles.exerciseName, { color: P.text }]}>{name}</Text>
      {sets.map((set) => (
        <View key={set.id} style={styles.setRow}>
          <View style={[styles.setBadge, { backgroundColor: P.sunken }]}>
            <Text style={[styles.setBadgeText, { color: P.textFaint }]}>{set.index}</Text>
          </View>
          <Text style={[styles.setDetail, { color: P.textDim }]}>
            {set.reps} reps{set.weight != null ? ` · ${set.weight}` : ''}
          </Text>
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
  sectionBody: { marginTop: 10, gap: 10 },
  exerciseBlock: { gap: 8 },
  exerciseName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setBadgeText: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  setDetail: { fontSize: 14, fontWeight: '500' },
});
