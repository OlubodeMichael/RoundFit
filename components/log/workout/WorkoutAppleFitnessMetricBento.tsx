import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { appleFitnessMetricAccent } from '@/components/log/workout/apple-fitness-detail-theme';
import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';
import { GradientCard } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

export interface AppleFitnessMetric {
  id: string;
  label: string;
  value: string;
  unit?: string;
  kind: 'calories' | 'heart';
  wide?: boolean;
}

export interface WorkoutAppleFitnessMetricBentoProps {
  metrics: AppleFitnessMetric[];
  delay?: number;
}

function MetricCell({
  metric,
  delay,
}: {
  metric: AppleFitnessMetric;
  delay: number;
}) {
  const P = usePalette();
  const accent = appleFitnessMetricAccent(metric.kind, P);
  const icon = metric.kind === 'heart' ? 'heart' : 'flame';

  return (
    <View style={[styles.cell, metric.wide && styles.cellWide]}>
      <GradientCard
        variant="workouts"
        palette={{ card: P.card, cardEdge: P.cardEdge, isDark: P.isDark }}
        layout="metric"
        corner={metric.kind === 'heart' ? 'top-right' : 'top-left'}
        delay={delay}
        style={styles.metricCard}
      >
        <View style={[styles.iconDot, { backgroundColor: accent.soft }]}>
          <Ionicons name={icon} size={14} color={accent.color} />
        </View>
        <View style={styles.metricCopy}>
          <Text style={[styles.label, { color: P.textFaint }]}>{metric.label}</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.value, { color: P.text }]}>{metric.value}</Text>
            {metric.unit != null && (
              <Text style={[styles.unit, { color: P.textDim }]}>{metric.unit}</Text>
            )}
          </View>
        </View>
      </GradientCard>
    </View>
  );
}

export function WorkoutAppleFitnessMetricBento({
  metrics,
  delay = 80,
}: WorkoutAppleFitnessMetricBentoProps) {
  if (metrics.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {metrics.map((metric, index) => (
          <MetricCell
            key={metric.id}
            metric={metric}
            delay={delay + index * 40}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: WORKOUT_DETAIL_PAD, marginTop: 14 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 140,
  },
  cellWide: {
    flexBasis: '100%',
    minWidth: '100%',
  },
  metricCard: { flex: 1 },
  iconDot: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCopy: { gap: 6, marginTop: 12 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: {
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
  },
  unit: { fontSize: 14, fontWeight: '600' },
});
