import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  appleFitnessHeroGradient,
  splitWorkoutDuration,
} from '@/components/log/workout/apple-fitness-detail-theme';
import { WorkoutActivityIcon } from '@/components/log/workout/WorkoutActivityIcon';
import { APPLE_FITNESS_HEART_COLOR } from '@/components/log/workout/workout-display';
import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';
import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import { AnimatedCard, usePalette } from '@/lib/log-theme';
import Ionicons from '@expo/vector-icons/Ionicons';

export interface WorkoutAppleFitnessHeroProps {
  title: string;
  catalogEntry: Pick<WorkoutCatalogEntry, 'icon' | 'sfSymbol'>;
  meta: string;
  durationSeconds: number;
  delay?: number;
}

function DurationDisplay({ durationSeconds }: { durationSeconds: number }) {
  const P = usePalette();
  const { hours, minutes, seconds } = splitWorkoutDuration(durationSeconds);
  const pad = (n: number) => String(n).padStart(2, '0');

  const segments =
    hours > 0
      ? [
          { value: String(hours), unit: 'hr' },
          { value: pad(minutes), unit: 'min' },
          { value: pad(seconds), unit: 'sec' },
        ]
      : [
          { value: String(minutes), unit: 'min' },
          { value: pad(seconds), unit: 'sec' },
        ];

  return (
    <View style={styles.durationRow} accessibilityLabel={`Duration ${hours} hours ${minutes} minutes ${seconds} seconds`}>
      {segments.map((segment, index) => (
        <View key={segment.unit} style={styles.durationSegment}>
          {index > 0 && (
            <Text style={[styles.durationColon, { color: P.textFaint }]}>:</Text>
          )}
          <Text style={[styles.durationValue, { color: P.text }]}>{segment.value}</Text>
          <Text style={[styles.durationUnit, { color: P.textDim }]}>{segment.unit}</Text>
        </View>
      ))}
    </View>
  );
}

export function WorkoutAppleFitnessHero({
  title,
  catalogEntry,
  meta,
  durationSeconds,
  delay = 0,
}: WorkoutAppleFitnessHeroProps) {
  const P = usePalette();
  const gradient = appleFitnessHeroGradient(P.isDark);

  return (
    <View style={styles.wrap}>
      <AnimatedCard delay={delay} padding={0} style={styles.cardShell}>
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.topRow}>
            <View style={styles.titleBlock}>
              <WorkoutActivityIcon entry={catalogEntry} variant="hero" />
              <Text style={[styles.title, { color: P.text }]} numberOfLines={2}>
                {title}
              </Text>
            </View>
            <View style={[styles.sourcePill, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
              <Ionicons name="heart" size={11} color={APPLE_FITNESS_HEART_COLOR} />
              <Text style={[styles.sourceText, { color: P.textDim }]}>Apple Fitness</Text>
            </View>
          </View>

          <Text style={[styles.meta, { color: P.textFaint }]}>{meta}</Text>

          <View style={styles.durationBlock}>
            <Text style={[styles.durationEyebrow, { color: P.textFaint }]}>Elapsed time</Text>
            <DurationDisplay durationSeconds={durationSeconds} />
          </View>
        </LinearGradient>
      </AnimatedCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: WORKOUT_DETAIL_PAD, marginTop: 6 },
  cardShell: { overflow: 'hidden' },
  gradient: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 26,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  title: {
    flex: 1,
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sourceText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  meta: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  durationBlock: { gap: 8 },
  durationEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 4,
  },
  durationSegment: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  durationColon: {
    fontSize: 32,
    fontWeight: '300',
    marginBottom: 6,
    marginHorizontal: 2,
  },
  durationValue: {
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  durationUnit: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
});
