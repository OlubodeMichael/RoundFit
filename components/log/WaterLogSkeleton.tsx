import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { TANK_HEIGHT_COMPACT } from '@/components/log/water-reservoir-styles';
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

function SkeletonCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const P = usePalette();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: P.card, borderColor: P.cardEdge },
        Platform.OS === 'android' && { elevation: 2 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function WaterLogSkeleton() {
  return (
    <View style={s.section}>
      <Block width={72} height={14} radius={6} style={{ marginLeft: 4, marginBottom: 8 }} />
      <View style={s.grid}>
        <SkeletonCard style={s.jarCard}>
          <Block width="100%" height={TANK_HEIGHT_COMPACT} radius={20} />
          <Block width="70%" height={28} radius={8} style={{ marginTop: 10 }} />
        </SkeletonCard>
        <SkeletonCard style={s.logCard}>
          <View style={s.logHeaderSk}>
            <Block width="48%" height={16} radius={6} />
            <Block width={28} height={28} radius={14} />
          </View>
          <Block width="100%" height={148} radius={12} style={{ marginTop: 10 }} />
        </SkeletonCard>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 8 },
  grid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    minHeight: 228,
    padding: 14,
  },
  jarCard: {
    flex: 0.9,
    minWidth: 0,
  },
  logCard: {
    flex: 1.1,
    minWidth: 0,
  },
  logHeaderSk: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
