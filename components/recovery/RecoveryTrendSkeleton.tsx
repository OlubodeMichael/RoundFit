import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { RecoveryTrendHero } from '@/components/recovery/RecoveryTrendHero';
import { RecoveryTrendStatsRow } from '@/components/recovery/RecoveryTrendStatsRow';
import { usePalette } from '@/lib/log-theme';
import type { TrendPalette, TrendStats } from '@/components/recovery/recovery-trend-utils';
import {
  currentMonthTitle,
  periodRangeLabel,
} from '@/components/recovery/recovery-trend-utils';
import { addLocalCalendarDays, getLocalDateString } from '@/utils/date';

const SCREEN_PAD = 20;
const CHART_H = 128;

const EMPTY_STATS: TrendStats = {
  average:    null,
  high:       null,
  low:        null,
  loggedDays: 0,
  totalDays:  0,
  momentum:   null,
};

function weekRangeLabel(): string {
  const end = getLocalDateString();
  const start = addLocalCalendarDays(end, -6);
  return periodRangeLabel([
    { date: start, score: 0 },
    { date: end, score: 0 },
  ]);
}

function SkeletonBlock({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | string;
  height: number;
  radius?: number;
  style?: object;
}) {
  const P = usePalette();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.28, 0.55],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: P.hair,
          opacity,
        },
        style,
      ]}
    />
  );
}

export interface RecoveryTrendSkeletonProps {
  period: 'W' | 'M';
  palette: TrendPalette;
  tint: string;
}

export function RecoveryTrendSkeleton({ period, palette, tint }: RecoveryTrendSkeletonProps) {
  const barCount = 7;

  const periodTitle = period === 'W' ? 'THIS WEEK' : 'LAST 30 DAYS';
  const periodSubtitle = period === 'W' ? weekRangeLabel() : currentMonthTitle();
  const chartTitle = period === 'W' ? '7-day trend' : 'Readiness map';
  const loadingHint =
    period === 'W'
      ? 'Loading your weekly readiness trend…'
      : 'Loading your monthly readiness map…';

  const emptyStats: TrendStats = {
    ...EMPTY_STATS,
    totalDays: period === 'W' ? 7 : 30,
  };

  return (
    <View style={styles.wrap}>
      <RecoveryTrendHero
        score={null}
        gaugeLabel=""
        tint={tint}
        periodTitle={periodTitle}
        periodSubtitle={periodSubtitle}
        palette={palette}
      />
      <RecoveryTrendStatsRow stats={emptyStats} palette={palette} />
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardEdge }]}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{chartTitle}</Text>
          <SkeletonBlock width={72} height={12} radius={4} />
        </View>
        <Text style={[styles.hint, { color: palette.textFaint }]}>{loadingHint}</Text>
        <View style={[styles.chartArea, { height: CHART_H }]}>
          {Array.from({ length: barCount }).map((_, i) => (
            <View key={i} style={styles.barCol}>
              <SkeletonBlock width="100%" height={CHART_H * (0.35 + (i % 3) * 0.15)} radius={4} />
              <SkeletonBlock width={14} height={10} radius={3} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    paddingHorizontal: SCREEN_PAD,
  },
  card: {
    borderRadius:      16,
    borderWidth:       StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     14,
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
  hint: {
    fontSize:     12,
    fontWeight:   '500',
    marginBottom: 12,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           5,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
  },
});
