import { StyleSheet, Text, View } from 'react-native';

import { RecoveryTrendGradientCard } from '@/components/recovery/RecoveryTrendGradientCard';
import {
  READINESS_BAND_COLORS,
  formatMomentum,
  type TrendPalette,
  type TrendStats,
} from '@/components/recovery/recovery-trend-utils';
import type { GradientCardCorner } from '@/components/ui/GradientCard';

const STAT_CORNERS: GradientCardCorner[] = [
  'top-left',
  'top-right',
  'bottom-right',
];

export interface RecoveryTrendStatsRowProps {
  stats: TrendStats;
  palette: TrendPalette;
  readinessScore?: number;
}

interface StatCellProps {
  label: string;
  value: string;
  hint?: string | null;
  accent?: string;
  palette: TrendPalette;
  readinessScore: number;
  corner: GradientCardCorner;
}

function StatCell({
  label,
  value,
  hint,
  accent,
  palette,
  readinessScore,
  corner,
}: StatCellProps) {
  return (
    <RecoveryTrendGradientCard
      palette={palette}
      readinessScore={readinessScore}
      corner={corner}
      layout="metric"
      style={styles.cellWrap}
    >
      <Text style={[styles.label, { color: palette.textFaint }]}>{label}</Text>
      <Text style={[styles.value, { color: accent ?? palette.text }]}>{value}</Text>
      {hint != null && hint.length > 0 && (
        <Text style={[styles.hint, { color: palette.textFaint }]}>{hint}</Text>
      )}
    </RecoveryTrendGradientCard>
  );
}

export function RecoveryTrendStatsRow({
  stats,
  palette,
  readinessScore = stats.average ?? stats.high ?? 0,
}: RecoveryTrendStatsRowProps) {
  const momentum = formatMomentum(stats.momentum);
  const momentumGood = stats.momentum != null && stats.momentum >= 0;

  return (
    <View style={styles.row}>
      <StatCell
        label="AVERAGE"
        value={stats.average != null ? String(stats.average) : '—'}
        hint={stats.loggedDays > 0 ? `${stats.loggedDays}d logged` : 'no data'}
        palette={palette}
        readinessScore={readinessScore}
        corner={STAT_CORNERS[0]}
      />
      <StatCell
        label="BEST"
        value={stats.high != null ? String(stats.high) : '—'}
        accent={stats.high != null ? READINESS_BAND_COLORS.high : undefined}
        palette={palette}
        readinessScore={stats.high ?? readinessScore}
        corner={STAT_CORNERS[1]}
      />
      <StatCell
        label="TREND"
        value={momentum ?? '—'}
        hint={stats.loggedDays >= 4 ? '2nd half vs 1st' : 'need more days'}
        accent={
          momentum != null
            ? momentumGood
              ? READINESS_BAND_COLORS.high
              : READINESS_BAND_COLORS.low
            : undefined
        }
        palette={palette}
        readinessScore={readinessScore}
        corner={STAT_CORNERS[2]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cellWrap: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontSize: 10,
    fontWeight: '500',
  },
});
