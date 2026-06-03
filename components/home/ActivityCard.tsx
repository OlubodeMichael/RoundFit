import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    StyleSheet,
    Text,
    View,
    type ViewStyle,
} from "react-native";

import { GradientCard, getCardAccent } from "@/components/ui/GradientCard";
import type { HealthData } from "@/context/health-context";
import { useStepsTarget } from "@/hooks/use-steps-target";
import { useUnits } from "@/hooks/use-units";
import {
    distanceUnitLabel,
    distanceValue,
    type DistanceUnit,
} from "@/utils/units";

export interface ActivityCardPalette {
  text: string;
  textDim: string;
  textFaint: string;
  card: string;
  cardEdge: string;
  water: string;
  waterSoft: string;
  protein: string;
  proteinSoft: string;
  hair: string;
  isDark: boolean;
}

interface MetricCardProps {
  P: ActivityCardPalette;
  delay?: number;
  style?: ViewStyle;
}

interface StepsMetricCardProps extends MetricCardProps {
  data: HealthData | null;
}

export function StepsMetricCard({
  P,
  delay = 0,
  data,
  style,
}: StepsMetricCardProps) {
  const stepsGoal = useStepsTarget();
  const steps = data?.steps ?? 0;
  const stepPct = Math.min(steps / stepsGoal, 1);
  const goalComplete = stepPct >= 1;
  const accent = getCardAccent('steps', P.isDark, { goalComplete });
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const stepColor = goalComplete ? P.protein : P.water;
  const stepFill = useRef(new Animated.Value(0)).current;
  const [displayedSteps, setDisplayedSteps] = useState(0);

  useEffect(() => {
    const countAnim = new Animated.Value(0);
    const id = countAnim.addListener(({ value }) =>
      setDisplayedSteps(Math.round(value)),
    );
    Animated.parallel([
      Animated.timing(stepFill, {
        toValue: stepPct,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(countAnim, {
        toValue: steps,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => countAnim.removeListener(id));
    return () => countAnim.removeListener(id);
  }, [steps, stepPct, stepFill]);

  const fillWidth = stepFill.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const pctLabel = Math.round(stepPct * 100);
  const valueColor = P.isDark ? P.text : "#3F3F46";

  return (
    <GradientCard
      variant="steps"
      palette={palette}
      accentOptions={{ goalComplete }}
      layout="metric"
      delay={delay}
      style={style}
    >
      <View style={s.cardHeader}>
        <View style={s.headerMain}>
          <View style={[s.iconRing, { backgroundColor: accent.iconSoft }]}>
            <View style={[s.iconBox, { backgroundColor: accent.iconBg }]}>
              <Ionicons name="footsteps" size={14} color="#FFF" />
            </View>
          </View>
          <Text style={[s.label, { color: P.textDim }]} numberOfLines={1}>
            Steps
          </Text>
        </View>
        <View
          style={[
            s.chip,
            { backgroundColor: goalComplete ? P.proteinSoft : P.waterSoft },
          ]}
        >
          {goalComplete ? (
            <Ionicons name="checkmark" size={10} color={P.protein} />
          ) : (
            <Text style={[s.chipText, { color: stepColor }]}>{pctLabel}%</Text>
          )}
        </View>
      </View>

      <View style={s.cardBody}>
        <Text
          style={[
            s.value,
            { color: valueColor, fontFamily: valueFont(P.isDark) },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {displayedSteps.toLocaleString()}
        </Text>
        <Text
          style={[s.sub, { color: P.textFaint }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {goalComplete
            ? "Goal complete"
            : `/ ${stepsGoal.toLocaleString()} goal`}
        </Text>
      </View>

      <View style={s.bottomSlot}>
        <View style={[s.track, { backgroundColor: P.hair }]}>
          <Animated.View
            style={[s.fill, { width: fillWidth, backgroundColor: stepColor }]}
          />
        </View>
      </View>
    </GradientCard>
  );
}

interface DistanceMetricCardProps extends MetricCardProps {
  data: HealthData | null;
}

export function DistanceMetricCard({
  P,
  delay = 0,
  data,
  style,
}: DistanceMetricCardProps) {
  const { profileUnit } = useUnits();
  const accent = getCardAccent('distance', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const distance = data?.distance ?? 0;
  const distNum = distanceValue(
    distance,
    (data?.distance_unit as DistanceUnit) ?? "km",
    profileUnit,
  );
  const distUnit = distanceUnitLabel(profileUnit);
  const valueColor = P.isDark ? P.text : "#3F3F46";

  return (
    <GradientCard
      variant="distance"
      palette={palette}
      layout="metric"
      delay={delay}
      style={style}
    >
      <View style={s.cardHeader}>
        <View style={s.headerMain}>
          <View style={[s.iconRing, { backgroundColor: accent.iconSoft }]}>
            <View style={[s.iconBox, { backgroundColor: accent.iconBg }]}>
              <Ionicons name="navigate-outline" size={14} color="#FFF" />
            </View>
          </View>
          <Text style={[s.label, { color: P.textDim }]}>Distance</Text>
        </View>
      </View>

      <View style={s.cardBody}>
        <View style={s.valueRow}>
          <Text
            style={[
              s.value,
              { color: valueColor, fontFamily: valueFont(P.isDark) },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {distNum}
          </Text>
          <Text style={[s.unit, { color: P.textFaint }]}>{distUnit}</Text>
        </View>
        <Text style={[s.sub, { color: P.textFaint }]}>Today</Text>
      </View>

      <View style={s.bottomSlot} />
    </GradientCard>
  );
}

interface ActivityMovementSectionProps {
  P: ActivityCardPalette;
  delay?: number;
  data: HealthData | null;
}

export function ActivityMovementSection({
  P,
  delay = 0,
  data,
}: ActivityMovementSectionProps) {
  return (
    <View style={s.metricsRow}>
      <StepsMetricCard P={P} delay={delay} data={data} />
      <DistanceMetricCard P={P} delay={delay + 20} data={data} />
    </View>
  );
}

function valueFont(isDark: boolean): string {
  return isDark ? "BarlowCondensed_800ExtraBold" : "BarlowCondensed_700Bold";
}

/** Reserves equal space under the value block on both metric cards. */
const METRIC_BOTTOM_SLOT_HEIGHT = 13;

const s = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  headerMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  cardBody: {
    flex: 1,
    justifyContent: "flex-end",
    minHeight: 44,
    minWidth: 0,
  },
  bottomSlot: {
    height: METRIC_BOTTOM_SLOT_HEIGHT,
    justifyContent: "flex-end",
  },
  iconRing: {
    padding: 3,
    borderRadius: 12,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  value: {
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    flexWrap: "wrap",
  },
  unit: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  sub: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
  chip: {
    flexShrink: 0,
    minWidth: 26,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  chipText: {
    fontSize: 9,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});
