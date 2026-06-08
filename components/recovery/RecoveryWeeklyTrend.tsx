import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { RecoveryWeeklyChart } from '@/components/recovery/RecoveryWeeklyChart';
import { RecoveryTrendGradientCard } from '@/components/recovery/RecoveryTrendGradientCard';
import { RecoveryTrendStatsRow } from '@/components/recovery/RecoveryTrendStatsRow';
import { RecoveryTrendHero } from '@/components/recovery/RecoveryTrendHero';
import type { ReadinessHistoryPoint } from '@/types/readiness';
import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';
import {
  computeTrendStats,
  periodRangeLabel,
} from '@/components/recovery/recovery-trend-utils';

const SCREEN_PAD = 20;

export interface RecoveryWeeklyTrendProps {
  points: ReadinessHistoryPoint[];
  todayScore: number | null;
  gaugeLabel: string;
  tint: string;
  palette: TrendPalette;
}

export function RecoveryWeeklyTrend({
  points,
  todayScore,
  gaugeLabel,
  tint,
  palette,
}: RecoveryWeeklyTrendProps) {
  const { width } = useWindowDimensions();
  const chartWidth = width - SCREEN_PAD * 2 - 32;
  const stats = computeTrendStats(points);
  const hasData = stats.loggedDays > 0;
  const readinessScore = todayScore ?? stats.average ?? 0;

  if (!hasData) {
    return (
      <View style={styles.wrap}>
        <RecoveryTrendGradientCard
          palette={palette}
          readinessScore={readinessScore}
          corner="bottom-left"
          contentStyle={styles.emptyInner}
        >
          <Ionicons name="analytics-outline" size={26} color={palette.textFaint} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            No weekly data yet
          </Text>
          <Text style={[styles.emptyBody, { color: palette.textFaint }]}>
            Log recovery for a few days to see your 7-day readiness trend.
          </Text>
        </RecoveryTrendGradientCard>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <RecoveryTrendHero
        score={todayScore}
        gaugeLabel={gaugeLabel}
        tint={tint}
        periodTitle="THIS WEEK"
        periodSubtitle={periodRangeLabel(points)}
        palette={palette}
        readinessScore={readinessScore}
      />
      <RecoveryTrendStatsRow
        stats={stats}
        palette={palette}
        readinessScore={readinessScore}
      />
      <RecoveryTrendGradientCard
        palette={palette}
        readinessScore={readinessScore}
        corner="bottom-left"
        contentStyle={styles.cardInner}
      >
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>7-day trend</Text>
          {stats.average != null && (
            <View style={[styles.avgPill, { backgroundColor: palette.sunken }]}>
              <Text style={[styles.avgText, { color: palette.textFaint }]}>
                avg <Text style={{ color: tint, fontWeight: '800' }}>{stats.average}</Text>
              </Text>
            </View>
          )}
        </View>
        <RecoveryWeeklyChart
          points={points}
          tint={tint}
          width={chartWidth}
          palette={palette}
        />
        <Text style={[styles.caption, { color: palette.textFaint }]}>
          Dashed line = weekly average
        </Text>
      </RecoveryTrendGradientCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    paddingHorizontal: SCREEN_PAD,
  },
  cardInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 4,
  },
  emptyInner: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 8,
  },
  cardHead: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  cardTitle: {
    fontSize:   15,
    fontWeight: '700',
  },
  avgPill: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      8,
  },
  avgText: {
    fontSize:   12,
    fontWeight: '600',
  },
  caption: {
    fontSize:   11,
    fontWeight: '500',
    textAlign:  'center',
    marginTop:  4,
  },
  emptyTitle: {
    fontSize:   15,
    fontWeight: '800',
  },
  emptyBody: {
    fontSize:     13,
    fontWeight:   '500',
    textAlign:    'center',
    lineHeight:   19,
  },
});
