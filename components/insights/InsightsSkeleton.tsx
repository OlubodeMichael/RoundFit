import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { usePalette } from '@/lib/log-theme';

const PULSE_MS = 700;

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
        Animated.timing(anim, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: PULSE_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: P.hair, opacity },
        style,
      ]}
    />
  );
}

function SkeletonCard({
  children,
  padding = 20,
}: {
  children: ReactNode;
  padding?: number;
}) {
  const P = usePalette();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: P.card, borderColor: P.cardEdge, padding },
      ]}
    >
      {children}
    </View>
  );
}

function GoalsSummarySkeleton() {
  return (
    <SkeletonCard>
      <SkeletonBlock width={80} height={10} radius={4} />
      <SkeletonBlock width={160} height={52} radius={8} style={{ marginTop: 12 }} />
      <View style={s.miniGoalsRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={s.miniGoalCol}>
            <SkeletonBlock width="100%" height={3} radius={2} />
            <SkeletonBlock width="70%" height={9} radius={3} />
          </View>
        ))}
      </View>
    </SkeletonCard>
  );
}

function HeroInsightSkeleton() {
  const P = usePalette();
  return (
    <SkeletonCard padding={0}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <SkeletonBlock width={140} height={10} radius={4} />
        <SkeletonBlock width="90%" height={28} radius={8} style={{ marginTop: 14 }} />
        <SkeletonBlock width="75%" height={28} radius={8} style={{ marginTop: 8 }} />
        <SkeletonBlock width="100%" height={14} radius={4} style={{ marginTop: 16 }} />
        <SkeletonBlock width="100%" height={14} radius={4} style={{ marginTop: 8 }} />
        <SkeletonBlock width="85%" height={14} radius={4} style={{ marginTop: 8 }} />
      </View>
      <View style={[s.heroFoot, { borderTopColor: P.hair }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={s.footBtn}>
            <SkeletonBlock width={56} height={14} radius={4} />
          </View>
        ))}
      </View>
    </SkeletonCard>
  );
}

function WeekChartSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonBlock width={100} height={12} radius={4} />
      <SkeletonBlock width={120} height={56} radius={10} style={{ marginTop: 12 }} />
      <SkeletonBlock width={140} height={16} radius={4} style={{ marginTop: 8 }} />
      <View style={s.weekBarsRow}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={s.weekBarCol}>
            <SkeletonBlock
              width="100%"
              height={40 + (i % 3) * 18}
              radius={5}
            />
            <SkeletonBlock width={14} height={10} radius={3} style={{ marginTop: 5 }} />
          </View>
        ))}
      </View>
    </SkeletonCard>
  );
}

function WeekBestDaySkeleton() {
  return (
    <SkeletonCard>
      <View style={s.bestRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBlock width={64} height={10} radius={4} />
          <SkeletonBlock width={120} height={22} radius={6} />
        </View>
        <SkeletonBlock width={80} height={16} radius={4} />
      </View>
    </SkeletonCard>
  );
}

function WeekAveragesSkeleton() {
  const P = usePalette();
  return (
    <SkeletonCard padding={18}>
      <SkeletonBlock width={120} height={18} radius={4} style={{ marginBottom: 16 }} />
      <View style={s.avgGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              s.avgCell,
              { borderColor: P.hair },
              i % 2 === 0 && s.avgCellRight,
              i < 2 && s.avgCellBottom,
            ]}
          >
            <SkeletonBlock width={60} height={12} radius={4} />
            <SkeletonBlock width={72} height={22} radius={6} style={{ marginTop: 8 }} />
            <SkeletonBlock width={100} height={12} radius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
    </SkeletonCard>
  );
}

export function TodayInsightsSkeleton() {
  return (
    <View style={s.stack}>
      <GoalsSummarySkeleton />
      <HeroInsightSkeleton />
    </View>
  );
}

export function WeekInsightsSkeleton() {
  return (
    <View style={s.stack}>
      <WeekChartSkeleton />
      <WeekBestDaySkeleton />
      <WeekAveragesSkeleton />
    </View>
  );
}

const s = StyleSheet.create({
  stack: {
    paddingHorizontal: 20,
    gap: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  miniGoalsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  miniGoalCol: {
    flex: 1,
    gap: 6,
  },
  heroFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footBtn: {
    flex: 1,
    alignItems: 'center',
  },
  weekBarsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 20,
    alignItems: 'flex-end',
    height: 120,
  },
  weekBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avgGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  avgCell: {
    width: '50%',
    paddingVertical: 10,
  },
  avgCellRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingRight: 14,
  },
  avgCellBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 14,
    marginBottom: 4,
  },
});
