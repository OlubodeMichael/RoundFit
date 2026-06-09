import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { APPLE_FITNESS_HEART_COLOR } from '@/components/log/workout/workout-display';
import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';
import { AnimatedCard, usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface WorkoutDetailHeroProps {
  icon: IoniconName;
  title: string;
  meta?: string;
  sourceLabel?: string | null;
  delay?: number;
}

export function WorkoutDetailHero({
  icon,
  title,
  meta,
  sourceLabel,
  delay = 0,
}: WorkoutDetailHeroProps) {
  const P = usePalette();

  return (
    <View style={styles.wrap}>
      <AnimatedCard delay={delay} padding={0} style={styles.card}>
        <View style={[styles.icon, { backgroundColor: P.workoutSoft }]}>
          <Ionicons name={icon} size={30} color={P.workout} />
        </View>
        {meta != null && (
          <Text style={[styles.meta, { color: P.textFaint }]}>{meta}</Text>
        )}
        <Text style={[styles.title, { color: P.text }]}>{title}</Text>
        {sourceLabel != null && (
          <View style={[styles.chip, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
            <Ionicons name="heart" size={11} color={APPLE_FITNESS_HEART_COLOR} />
            <Text style={[styles.chipText, { color: P.textDim }]}>{sourceLabel}</Text>
          </View>
        )}
      </AnimatedCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: WORKOUT_DETAIL_PAD, marginTop: 4 },
  card: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 20 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  meta: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1, textAlign: 'center' },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 32,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
});
