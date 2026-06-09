import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnimatedCard, FieldLabel, usePalette } from '@/lib/log-theme';
import type { HealthKitHeartRatePoint } from '@/utils/healthkit';

const BAR_COUNT = 24;
import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';

export interface WorkoutHeartRateChartProps {
  points: HealthKitHeartRatePoint[];
}

export function WorkoutHeartRateChart({ points }: WorkoutHeartRateChartProps) {
  const P = usePalette();

  const bars = useMemo(() => {
    if (points.length === 0) return [];

    const startMs = points[0].timestamp.getTime();
    const endMs = points[points.length - 1].timestamp.getTime();
    const spanMs = Math.max(endMs - startMs, 1);
    const bucketMs = spanMs / BAR_COUNT;
    const buckets: number[] = Array.from({ length: BAR_COUNT }, () => 0);
    const counts: number[] = Array.from({ length: BAR_COUNT }, () => 0);

    for (const point of points) {
      const index = Math.min(
        BAR_COUNT - 1,
        Math.floor((point.timestamp.getTime() - startMs) / bucketMs),
      );
      buckets[index] += point.bpm;
      counts[index] += 1;
    }

    const values = buckets.map((sum, index) => (
      counts[index] > 0 ? Math.round(sum / counts[index]) : 0
    ));
    const max = Math.max(...values, 1);
    return values.map((bpm) => ({ bpm, height: bpm > 0 ? bpm / max : 0 }));
  }, [points]);

  if (bars.length === 0) return null;

  const avg = Math.round(points.reduce((sum, p) => sum + p.bpm, 0) / points.length);
  const peak = Math.max(...points.map((p) => p.bpm));

  return (
    <View style={styles.sectionPad}>
      <AnimatedCard delay={180}>
        <View style={styles.header}>
          <FieldLabel>Heart rate</FieldLabel>
          <Text style={[styles.sub, { color: P.textFaint }]}>
            avg {avg} · peak {peak} bpm
          </Text>
        </View>
        <View style={styles.chartRow}>
          {bars.map((bar, index) => (
            <View key={index} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.max(8, Math.round(bar.height * 100))}%`,
                    backgroundColor: P.danger,
                    opacity: bar.bpm > 0 ? 0.85 : 0.15,
                  },
                ]}
              />
            </View>
          ))}
        </View>
      </AnimatedCard>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionPad: {
    paddingHorizontal: WORKOUT_DETAIL_PAD,
    marginTop: 14,
  },
  header: {
    gap: 4,
    marginBottom: 14,
  },
  sub: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 96,
    gap: 3,
  },
  barCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
});
