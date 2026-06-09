import { StyleSheet, Text, View } from 'react-native';

import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';
import { AnimatedCard, FieldLabel, usePalette } from '@/lib/log-theme';

export interface WorkoutHighlightMetric {
  label: string;
  value: string;
  unit?: string;
}

export interface WorkoutDetailHighlightStripProps {
  metrics: WorkoutHighlightMetric[];
  delay?: number;
}

export function WorkoutDetailHighlightStrip({
  metrics,
  delay = 60,
}: WorkoutDetailHighlightStripProps) {
  const P = usePalette();

  return (
    <View style={styles.pad}>
      <AnimatedCard delay={delay}>
        <FieldLabel>Session summary</FieldLabel>
        <View style={[styles.row, { borderTopColor: P.hair }]}>
          {metrics.map((metric, index) => (
            <View key={metric.label} style={styles.cell}>
              {index > 0 && (
                <View style={[styles.divider, { backgroundColor: P.hair }]} />
              )}
              <Text style={[styles.label, { color: P.textFaint }]}>{metric.label}</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.value, { color: P.text }]}>{metric.value}</Text>
                {metric.unit != null && (
                  <Text style={[styles.unit, { color: P.textDim }]}>{metric.unit}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </AnimatedCard>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: WORKOUT_DETAIL_PAD, marginTop: 14 },
  row: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cell: { flex: 1, alignItems: 'center', gap: 4, position: 'relative' },
  divider: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
  },
  unit: { fontSize: 14, fontWeight: '600' },
});
