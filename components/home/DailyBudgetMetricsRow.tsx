import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import {
  DistanceMetricCard,
  StepsMetricCard,
  type ActivityCardPalette,
} from '@/components/home/ActivityCard';
import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import type { CardAccentVariant } from '@/components/ui/gradient-card-theme';
import type { HealthData } from '@/context/health-context';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const BOTTOM_SLOT_HEIGHT = 13;
const HEADER_ICON_SIZE = 26;

/** Home palette — includes budget + movement metric fields. */
export type DailyBudgetMetricsPalette = ActivityCardPalette & {
  calories: string;
  caloriesSoft: string;
};

export interface DailyBudgetMetricsRowProps {
  P: DailyBudgetMetricsPalette;
  delay?: number;
  eaten: number;
  goal: number;
  burned: number;
  /** Steps + distance metrics; null shows zeros until health data loads. */
  healthData?: HealthData | null;
}

export function DailyBudgetMetricsRow({
  P,
  delay = 0,
  eaten,
  goal,
  burned,
  healthData = null,
}: DailyBudgetMetricsRowProps) {
  const isOver = eaten > goal;

  return (
    <View style={s.grid}>
      <View style={s.gridRow}>
        <BudgetMetricCard
          P={P}
          variant="protein"
          icon="restaurant"
          label="Eaten"
          value={eaten}
          sub={`/ ${goal.toLocaleString()} kcal`}
          progress={Math.min(eaten / Math.max(goal, 1), 1)}
          trailLabel={isOver ? 'Over' : undefined}
          trailPct={
            isOver ? undefined : Math.round((eaten / Math.max(goal, 1)) * 100)
          }
          fillColor={isOver ? P.calories : P.protein}
          delay={delay}
          style={s.cell}
        />
        <BudgetMetricCard
          P={P}
          variant="calories"
          icon="flame"
          label="Burn"
          value={burned}
          sub="kcal today"
          delay={delay + 20}
          style={s.cell}
        />
      </View>

      <View style={s.gridRow}>
        <StepsMetricCard
          P={P}
          delay={delay + 40}
          data={healthData}
          style={s.cell}
        />
        <DistanceMetricCard
          P={P}
          delay={delay + 60}
          data={healthData}
          style={s.cell}
        />
      </View>
    </View>
  );
}

interface BudgetMetricCardProps {
  P: DailyBudgetMetricsPalette;
  variant: CardAccentVariant;
  icon: IoniconName;
  label: string;
  value: number;
  sub: string;
  progress?: number;
  trailLabel?: string;
  trailPct?: number;
  fillColor?: string;
  delay?: number;
  style?: ViewStyle;
}

function BudgetMetricCard({
  P,
  variant,
  icon,
  label,
  value,
  sub,
  progress,
  trailLabel,
  trailPct,
  fillColor,
  delay = 0,
  style,
}: BudgetMetricCardProps) {
  const accent = getCardAccent(variant, P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const barColor = fillColor ?? accent.iconBg;

  const anim = useRef(new Animated.Value(progress ?? 0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const id = countAnim.addListener(({ value: v }) => setDisplayed(Math.round(v)));
    Animated.timing(countAnim, {
      toValue: value,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => countAnim.removeListener(id);
  }, [value, delay, countAnim]);

  useEffect(() => {
    if (progress === undefined) return;
    Animated.timing(anim, {
      toValue: progress,
      duration: 900,
      delay: delay + 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, delay, anim]);

  const fillWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const valueColor = P.isDark ? P.text : '#3F3F46';
  const showTrail = trailLabel != null || trailPct != null;

  return (
    <GradientCard
      variant={variant}
      palette={palette}
      layout="metric"
      delay={delay}
      style={style}
    >
      <View style={s.cardHeader}>
        <View style={s.headerMain}>
          <Ionicons name={icon} size={HEADER_ICON_SIZE} color={accent.iconBg} />
          <Text style={[s.label, { color: P.textDim }]}>{label}</Text>
        </View>
        {showTrail ? (
          <View style={s.headerTrail}>
            {trailLabel ? (
              <Text
                style={[s.headerMeta, { color: P.textFaint }]}
                numberOfLines={1}
              >
                {trailLabel}
              </Text>
            ) : null}
            {trailPct != null ? (
              <Text style={[s.trailPct, { color: barColor }]}>{trailPct}%</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={s.cardBody}>
        <Text
          style={[
            s.value,
            { color: valueColor, fontFamily: valueFont(P.isDark) },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
        >
          {displayed.toLocaleString()}
        </Text>
        <Text style={[s.sub, { color: P.textFaint }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>

      <View style={s.bottomSlot}>
        {progress !== undefined ? (
          <View style={[s.track, { backgroundColor: P.hair }]}>
            <Animated.View
              style={[s.fill, { width: fillWidth, backgroundColor: barColor }]}
            />
          </View>
        ) : null}
      </View>
    </GradientCard>
  );
}

function valueFont(isDark: boolean): string {
  return isDark ? 'BarlowCondensed_800ExtraBold' : 'BarlowCondensed_700Bold';
}

const s = StyleSheet.create({
  grid: {
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  headerTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    maxWidth: '48%',
  },
  headerMeta: {
    fontSize: 9,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  trailPct: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  cardBody: {
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 48,
  },
  bottomSlot: {
    height: BOTTOM_SLOT_HEIGHT,
    justifyContent: 'flex-end',
  },
  value: {
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
