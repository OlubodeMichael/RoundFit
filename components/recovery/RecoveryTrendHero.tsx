import { StyleSheet, Text, View } from 'react-native';

import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';

export interface RecoveryTrendHeroProps {
  score: number | null;
  gaugeLabel: string;
  tint: string;
  periodTitle: string;
  periodSubtitle: string;
  palette: TrendPalette;
}

export function RecoveryTrendHero({
  score,
  gaugeLabel,
  tint,
  periodTitle,
  periodSubtitle,
  palette,
}: RecoveryTrendHeroProps) {
  return (
    <View style={[styles.wrap, { backgroundColor: palette.card, borderColor: palette.cardEdge }]}>
      <View style={styles.left}>
        <Text style={[styles.periodTitle, { color: palette.textFaint }]}>{periodTitle}</Text>
        <Text style={[styles.periodSub, { color: palette.text }]}>{periodSubtitle}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    borderRadius:      16,
    borderWidth:       StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical:   14,
  },
  left: {
    flex: 1,
    gap:  3,
    paddingRight: 12,
  },
  periodTitle: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
  },
  periodSub: {
    fontSize:   15,
    fontWeight: '700',
  },
  right: {
    alignItems: 'flex-end',
    gap:        2,
  },
  badge: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           2,
  },
  score: {
    fontSize:      40,
    fontWeight:    '800',
    letterSpacing: -2,
    lineHeight:    42,
  },
  of: {
    fontSize:   13,
    fontWeight: '600',
  },
  today: {
    fontSize:   11,
    fontWeight: '500',
  },
});
