import { StyleSheet, Text, View } from 'react-native';

import { PHASE_META } from '@/components/cycle/cycle-phase-config';
import type { Palette } from '@/lib/log-theme';

export interface CycleMetricsRowProps {
  P: Palette;
  cycleDay: number | null;
  cycleLength: number;
  daysUntilNext: number | null;
  daysRemaining: number | null;
}

interface MetricTileProps {
  label: string;
  value: string;
  unit: string;
  color: string;
  P: Palette;
}

function MetricTile({ label, value, unit, color, P }: MetricTileProps) {
  return (
    <View style={[s.tile, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <View style={[s.dotWrap, { backgroundColor: `${color}22` }]}>
        <View style={[s.dot, { backgroundColor: color }]} />
      </View>
      <Text style={[s.value, { color: P.text }]}>{value}</Text>
      <Text style={[s.unit, { color: P.textFaint }]}>{unit}</Text>
      <Text style={[s.label, { color: P.textFaint }]}>{label}</Text>
    </View>
  );
}

export function CycleMetricsRow({
  P,
  cycleDay,
  cycleLength,
  daysUntilNext,
  daysRemaining,
}: CycleMetricsRowProps) {
  const nextValue = daysUntilNext == null
    ? '—'
    : daysUntilNext <= 0
      ? 'Today'
      : String(daysUntilNext);
  const nextUnit = daysUntilNext != null && daysUntilNext > 0 ? 'days away' : 'next period';

  return (
    <View style={s.row}>
      <MetricTile
        label="Cycle day"
        value={cycleDay != null ? String(cycleDay) : '—'}
        unit={`of ${cycleLength}`}
        color={P.body}
        P={P}
      />
      <MetricTile
        label="Next period"
        value={nextValue}
        unit={nextUnit}
        color={PHASE_META.menstrual.color}
        P={P}
      />
      <MetricTile
        label="Remaining"
        value={daysRemaining != null ? String(daysRemaining) : '—'}
        unit="days left"
        color={PHASE_META.luteal.color}
        P={P}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 3,
  },
  dotWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  value: {
    fontFamily: 'BarlowCondensed_800ExtraBold',
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  unit: { fontSize: 11, fontWeight: '500' },
  label: { fontSize: 10, fontWeight: '500' },
});
