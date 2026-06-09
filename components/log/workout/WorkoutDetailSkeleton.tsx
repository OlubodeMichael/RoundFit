import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { usePalette } from '@/lib/log-theme';

import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';

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

function HeroSkeleton() {
  return (
    <View style={s.heroPad}>
      <SkeletonCard style={s.heroCard}>
        <Block width={64} height={64} radius={20} />
        <Block width="58%" height={13} radius={4} />
        <Block width="72%" height={28} radius={8} />
        <Block width="40%" height={22} radius={11} />
      </SkeletonCard>
    </View>
  );
}

function HighlightSkeleton() {
  return (
    <View style={s.sectionPad}>
      <SkeletonCard style={s.highlightCard}>
        <Block width="42%" height={10} radius={4} />
        <View style={s.highlightRow}>
          <View style={s.highlightCell}>
            <Block width="50%" height={10} radius={4} />
            <Block width="70%" height={28} radius={6} />
          </View>
          <View style={s.highlightCell}>
            <Block width="50%" height={10} radius={4} />
            <Block width="70%" height={28} radius={6} />
          </View>
        </View>
      </SkeletonCard>
    </View>
  );
}

function DetailRowsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View style={s.sectionPad}>
      <SkeletonCard style={s.rowsCard}>
        {Array.from({ length: count }, (_, index) => (
          <View key={index} style={s.detailRow}>
            <Block width={32} height={32} radius={10} />
            <Block width="38%" height={14} radius={4} style={{ flex: 1 }} />
            <Block width="22%" height={14} radius={4} />
          </View>
        ))}
      </SkeletonCard>
    </View>
  );
}

export function WorkoutMetricsSkeleton() {
  return (
    <>
      <HighlightSkeleton />
      <DetailRowsSkeleton count={2} />
    </>
  );
}

export interface WorkoutDetailSkeletonProps {
  variant?: 'standard' | 'apple';
}

export function WorkoutDetailSkeleton({ variant = 'standard' }: WorkoutDetailSkeletonProps) {
  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <HeroSkeleton />
      <HighlightSkeleton />
      <DetailRowsSkeleton count={variant === 'apple' ? 2 : 3} />
      <View style={s.sectionPad}>
        <Block width="100%" height={160} radius={24} />
      </View>
      <View style={s.sectionPad}>
        <Block width="100%" height={52} radius={16} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 40 },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroPad: {
    paddingHorizontal: WORKOUT_DETAIL_PAD,
    marginTop: 4,
  },
  heroCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  sectionPad: {
    paddingHorizontal: WORKOUT_DETAIL_PAD,
    marginTop: 14,
  },
  highlightCard: {
    padding: 20,
    gap: 14,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 12,
  },
  highlightCell: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  rowsCard: {
    paddingVertical: 4,
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
