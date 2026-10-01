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
          <Ionicons name={icon} size={27} color={P.workout} />
        </View>
        <View style={styles.copy}>
          {meta != null && (
            <Text style={[styles.meta, { color: P.textFaint }]}>{meta}</Text>
          )}
          <Text style={[styles.title, { color: P.text }]}>{title}</Text>
          {sourceLabel != null && (
            <View style={styles.sourceRow}>
              <Ionicons
                name={sourceLabel === 'Apple Fitness' ? 'heart' : 'checkmark-circle'}
                size={13}
                color={sourceLabel === 'Apple Fitness' ? APPLE_FITNESS_HEART_COLOR : P.workout}
              />
              <Text style={[styles.sourceText, { color: P.textDim }]}>{sourceLabel}</Text>
            </View>
          )}
        </View>
      </AnimatedCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: WORKOUT_DETAIL_PAD, marginTop: 4 },
  card: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  icon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, alignItems: 'flex-start', gap: 4 },
  meta: { fontSize: 12, fontWeight: '600', letterSpacing: 0.1 },
  title: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  sourceText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
});
