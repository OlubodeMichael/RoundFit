import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { HealthKitHeartRatePoint } from '@/utils/healthkit';
import { usePalette } from '@/lib/log-theme';

const BAR_COUNT = 24;

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
    <View style={[styles.wrap, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: P.text }]}>Heart Rate</Text>
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
                  backgroundColor: '#EF4444',
                  opacity: bar.bpm > 0 ? 0.85 : 0.15,
                },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  header: { gap: 2 },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, fontWeight: '600' },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 88,
    gap: 3,
  },
  barCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 4,
  },
});
