import { StyleSheet, Text, View } from 'react-native';

import { RecoveryTrendGradientCard } from '@/components/recovery/RecoveryTrendGradientCard';
import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';

export interface RecoveryTrendHeroProps {
  score: number | null;
  gaugeLabel: string;
  tint: string;
  periodTitle: string;
  periodSubtitle: string;
  palette: TrendPalette;
  readinessScore?: number;
}

export function RecoveryTrendHero({
  score,
  gaugeLabel,
  tint,
  periodTitle,
  periodSubtitle,
  palette,
  readinessScore = score ?? 0,
}: RecoveryTrendHeroProps) {
  return (
    <RecoveryTrendGradientCard
      palette={palette}
      readinessScore={readinessScore}
      corner="top-left"
      contentStyle={styles.inner}
    >
      <View style={styles.left}>
        <Text style={[styles.periodTitle, { color: palette.textFaint }]}>
          {periodTitle}
        </Text>
        <Text style={[styles.periodSub, { color: palette.text }]}>
          {periodSubtitle}
        </Text>
      </View>
      <View style={styles.right}>
        {gaugeLabel.length > 0 && (
          <Text style={[styles.badge, { color: tint }]}>{gaugeLabel}</Text>
        )}
        <View style={styles.scoreRow}>
          <Text style={[styles.score, { color: palette.text }]}>
            {score !== null ? score : '—'}
          </Text>
          <Text style={[styles.of, { color: palette.textFaint }]}>/100</Text>
        </View>
        <Text style={[styles.today, { color: palette.textFaint }]}>today</Text>
      </View>
    </RecoveryTrendGradientCard>
  );
}

const styles = StyleSheet.create({
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  left: {
    flex: 1,
    gap: 3,
    paddingRight: 12,
    minWidth: 0,
  },
  periodTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  periodSub: {
    fontSize: 15,
    fontWeight: '700',
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  badge: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  score: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 42,
    fontVariant: ['tabular-nums'],
  },
  of: {
    fontSize: 13,
    fontWeight: '600',
  },
  today: {
    fontSize: 11,
    fontWeight: '500',
  },
});
