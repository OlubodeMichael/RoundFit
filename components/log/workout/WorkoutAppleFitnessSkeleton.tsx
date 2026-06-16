import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';
import { usePalette } from '@/lib/log-theme';

function Block({
  width,
  height,
  radius = 10,
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
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.5],
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

function SkeletonCard({ children, style }: { children: ReactNode; style?: object }) {
  const P = usePalette();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: P.card, borderColor: P.cardEdge },
        Platform.OS === 'android' && { elevation: 2 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface WorkoutAppleFitnessSkeletonProps {
  showHeartRate?: boolean;
}

export function WorkoutAppleFitnessSkeleton({
  showHeartRate = true,
}: WorkoutAppleFitnessSkeletonProps) {
  return (
    <>
      <View style={styles.metricsPad}>
        <View style={styles.bentoRow}>
          <SkeletonCard style={styles.bentoCell}>
            <Block width={30} height={30} radius={10} />
            <Block width="55%" height={10} radius={4} style={{ marginTop: 14 }} />
            <Block width="70%" height={30} radius={8} style={{ marginTop: 8 }} />
          </SkeletonCard>
          <SkeletonCard style={styles.bentoCell}>
            <Block width={30} height={30} radius={10} />
            <Block width="55%" height={10} radius={4} style={{ marginTop: 14 }} />
            <Block width="70%" height={30} radius={8} style={{ marginTop: 8 }} />
          </SkeletonCard>
        </View>
        <SkeletonCard style={styles.bentoWide}>
          <Block width={30} height={30} radius={10} />
          <Block width="45%" height={10} radius={4} style={{ marginTop: 14 }} />
          <Block width="35%" height={30} radius={8} style={{ marginTop: 8 }} />
        </SkeletonCard>
      </View>
      {showHeartRate && (
        <View style={styles.chartPad}>
          <SkeletonCard style={styles.chartCard}>
            <Block width="30%" height={10} radius={4} />
            <Block width="55%" height={18} radius={6} style={{ marginTop: 10 }} />
            <Block width="100%" height={150} radius={12} style={{ marginTop: 16 }} />
          </SkeletonCard>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  metricsPad: {
    paddingHorizontal: WORKOUT_DETAIL_PAD,
    marginTop: 14,
    gap: 10,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bentoCell: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    minHeight: 118,
  },
  bentoWide: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    minHeight: 118,
  },
  chartPad: {
    paddingHorizontal: WORKOUT_DETAIL_PAD,
    marginTop: 14,
  },
  chartCard: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
});
