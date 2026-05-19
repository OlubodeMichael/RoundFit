import { StyleSheet, Text, View } from 'react-native';

import type { TrendPalette, TrendStats } from '@/components/recovery/recovery-trend-utils';
import { formatMomentum } from '@/components/recovery/recovery-trend-utils';

export interface RecoveryTrendStatsRowProps {
  stats: TrendStats;
  palette: TrendPalette;
}

interface StatCellProps {
  label: string;
  value: string;
  hint?: string | null;
  accent?: string;
  palette: TrendPalette;
}

function StatCell({ label, value, hint, accent, palette }: StatCellProps) {
  return (
    <View style={[styles.cell, { backgroundColor: palette.card, borderColor: palette.cardEdge }]}>
      <Text style={[styles.label, { color: palette.textFaint }]}>{label}</Text>
      <Text style={[styles.value, { color: accent ?? palette.text }]}>{value}</Text>
      {hint != null && hint.length > 0 && (
        <Text style={[styles.hint, { color: palette.textFaint }]}>{hint}</Text>
      )}
    </View>
  );
}

export function RecoveryTrendStatsRow({ stats, palette }: RecoveryTrendStatsRowProps) {
  const momentum = formatMomentum(stats.momentum);
  const momentumGood = stats.momentum != null && stats.momentum >= 0;

  return (
    <View style={styles.row}>
      <StatCell
        label="AVERAGE"
        value={stats.average != null ? String(stats.average) : '—'}
        hint={stats.loggedDays > 0 ? `${stats.loggedDays}d logged` : 'no data'}
        palette={palette}
      />
      <StatCell
        label="BEST"
        value={stats.high != null ? String(stats.high) : '—'}
        accent={stats.high != null ? palette.protein : undefined}
        palette={palette}
      />
      <StatCell
        label="TREND"
        value={momentum ?? '—'}
        hint={stats.loggedDays >= 4 ? '2nd half vs 1st' : 'need more days'}
        accent={momentum != null ? (momentumGood ? palette.protein : palette.calories) : undefined}
        palette={palette}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex:              1,
    borderRadius:      14,
    borderWidth:       StyleSheet.hairlineWidth,
    paddingVertical:   12,
    paddingHorizontal: 10,
    gap:               3,
    minHeight:         72,
    justifyContent:    'center',
  },
  label: {
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1,
  },
  value: {
    fontSize:   20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  hint: {
    fontSize:   10,
    fontWeight: '500',
  },
});
