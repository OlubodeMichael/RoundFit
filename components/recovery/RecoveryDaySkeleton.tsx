import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { RecoveryTrendGradientCard } from '@/components/recovery/RecoveryTrendGradientCard';
import { usePalette } from '@/lib/log-theme';

const SCREEN_PAD = 20;

const LOADING_INSIGHT =
  'Analyzing your sleep, HRV, and training load to build today\u2019s readiness score.';

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

export interface RecoveryDaySkeletonProps {
  gaugeSize: number;
}

export function RecoveryDaySkeleton({ gaugeSize }: RecoveryDaySkeletonProps) {
  const P = usePalette();
  const gaugeH = Math.round(gaugeSize * 0.78);

  return (
    <View style={styles.wrap}>
      <View style={[styles.gaugeWrap, { height: gaugeH }]}>
        <View
          style={[
            styles.arcTrack,
            {
              width:  gaugeSize,
              height: gaugeSize,
              borderColor: P.hair,
            },
          ]}
        />
        <View style={styles.gaugeCenter}>
          <SkeletonBlock width={52} height={9} radius={4} />
          <SkeletonBlock width={72} height={48} radius={10} style={{ marginTop: 10 }} />
          <SkeletonBlock width={64} height={11} radius={4} style={{ marginTop: 8 }} />
        </View>
      </View>

      <View style={styles.insight}>
        <Text style={[styles.insightText, { color: P.textDim }]}>{LOADING_INSIGHT}</Text>
      </View>

      <View style={[styles.metricsGrid, { paddingHorizontal: SCREEN_PAD }]}>
        <View style={styles.metricsRow}>
          {[0, 1].map((i) => (
            <RecoveryTrendGradientCard
              key={i}
              palette={P}
              readinessScore={0}
              corner={i === 0 ? 'top-left' : 'top-right'}
              layout="metric"
              style={styles.metricCardWrap}
              contentStyle={styles.metricCardInner}
            >
              <SkeletonBlock width="40%" height={9} radius={4} />
              <SkeletonBlock width="55%" height={24} radius={6} style={{ marginTop: 10 }} />
              <SkeletonBlock width="70%" height={10} radius={4} style={{ marginTop: 8 }} />
            </RecoveryTrendGradientCard>
          ))}
        </View>
        <View style={styles.metricsRow}>
          {[0, 1].map((i) => (
            <RecoveryTrendGradientCard
              key={i}
              palette={P}
              readinessScore={0}
              corner={i === 0 ? 'bottom-left' : 'bottom-right'}
              layout="metric"
              style={styles.metricCardWrap}
              contentStyle={styles.metricCardInner}
            >
              <SkeletonBlock width="40%" height={9} radius={4} />
              <SkeletonBlock width="55%" height={24} radius={6} style={{ marginTop: 10 }} />
              <SkeletonBlock width="70%" height={10} radius={4} style={{ marginTop: 8 }} />
            </RecoveryTrendGradientCard>
          ))}
        </View>
      </View>

      <View style={styles.factorsWrap}>
        <View style={styles.factorsHeader}>
          <Text style={[styles.factorsTitle, { color: P.textFaint }]}>WHAT MOVED THE SCORE</Text>
          <Ionicons name="trending-up-outline" size={13} color={P.textFaint} />
        </View>
        <RecoveryTrendGradientCard
          palette={P}
          readinessScore={0}
          corner="bottom-left"
          contentStyle={styles.factorsCardInner}
        >
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.factorRow}>
              <View style={{ flex: 1, gap: 8 }}>
                <SkeletonBlock width="45%" height={12} radius={4} />
                <SkeletonBlock width="100%" height={4} radius={2} />
              </View>
              <SkeletonBlock width={28} height={20} radius={4} />
            </View>
          ))}
        </RecoveryTrendGradientCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 20,
  },
  gaugeWrap: {
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      -4,
  },
  arcTrack: {
    position:     'absolute',
    top:          0,
    borderWidth:  12,
    borderRadius: 999,
    opacity:      0.55,
  },
  gaugeCenter: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  insight: {
    paddingHorizontal: SCREEN_PAD + 8,
  },
  insightText: {
    fontSize:   14,
    fontWeight: '500',
    lineHeight: 21,
    textAlign:  'center',
  },
  metricsGrid: {
    gap: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCardWrap: {
    flex: 1,
    minWidth: 0,
  },
  metricCardInner: {
    minHeight: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  factorsWrap: {
    paddingHorizontal: SCREEN_PAD,
    gap:               10,
  },
  factorsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  factorsTitle: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
  },
  factorsCardInner: {
    padding: 14,
    overflow: 'hidden',
  },
  factorRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  12,
  },
});
