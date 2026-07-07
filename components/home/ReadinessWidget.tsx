import Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { GradientCard, getCardAccent } from "@/components/ui/GradientCard";
import {
  AnimatedMascot,
  moodFromReadinessRecommendation,
} from "@/components/mascot/AnimatedMascot";
import { scoreTint } from "@/components/recovery/recovery-trend-utils";
import { useHealth } from "@/context/health-context";
import { useRecovery } from "@/hooks/use-recovery";
import { usePalette } from "@/lib/log-theme";
import { formatSleepDuration } from "@/utils/sleep-quality";
import type { ReadinessFactor } from "@/types/readiness";

const G = 80;
const GC = G / 2;
const GR = G * 0.41;
const GSW = 7;
const GAS = 225;
const GAT = 270;
const GH = Math.round(G * 0.78);
const HEADER_ICON_SIZE = 30;

const HEADLINES: Record<string, string> = {
  "Train hard": "Push it today",
  Moderate: "Steady effort",
  "Light workout": "Take it easy",
  Rest: "Rest up today",
};

const LOAD_SHORT: Record<string, string> = {
  "Train hard": "High",
  Moderate: "Mod.",
  "Light workout": "Light",
  Rest: "Rest",
};

function degXY(deg: number) {
  const rad = deg * (Math.PI / 180);
  return { x: GC + GR * Math.sin(rad), y: GC - GR * Math.cos(rad) };
}

function arc(start: number, span: number) {
  const s = degXY(start);
  const e = degXY(start + span);
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${GR} ${GR} 0 ${span > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function proteinGrams(factor: ReadinessFactor | undefined): string {
  if (!factor?.value || factor.value === "—") return "–";
  const match = factor.value.match(/(\d+)\s*g/);
  if (match) return `${match[1]}g`;
  return factor.value.length > 8 ? factor.value.slice(0, 8) : factor.value;
}

interface StatCellProps {
  label: string;
  value: string;
  detail?: string;
  detailColor?: string;
  textColor: string;
  faintColor: string;
}

function StatCell({
  label,
  value,
  detail,
  detailColor,
  textColor,
  faintColor,
}: StatCellProps) {
  return (
    <View style={s.stat}>
      <Text style={[s.statLabel, { color: faintColor }]}>{label}</Text>
      <Text style={[s.statValue, { color: textColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text
        style={[
          s.statDetail,
          {
            color: detail != null ? (detailColor ?? faintColor) : "transparent",
          },
        ]}
        numberOfLines={1}
      >
        {detail ?? " "}
      </Text>
    </View>
  );
}

export interface ReadinessWidgetProps {
  delay?: number;
  /** Where the recovery detail screen should return when back isn't available. */
  returnTo?: Href;
}

export function ReadinessWidget({
  delay = 0,
  returnTo,
}: ReadinessWidgetProps) {
  const router = useRouter();
  const P = usePalette();
  const { display, today } = useRecovery();
  const { today: healthToday } = useHealth();
  const score = display.score;
  if (score === null) return null;

  const accent = getCardAccent('readiness', P.isDark, { readinessScore: score });
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const ringColor = scoreTint(score, P);
  const trackClr = P.isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.07)";

  const sleepFactor = display.factors.find((f) => f.pillar === "sleep");
  const fuelFactor = display.factors.find((f) => f.pillar === "nutrition");

  const hrv = today?.hrv ?? healthToday?.hrv ?? null;
  const rhr =
    today?.resting_heart_rate ?? healthToday?.resting_heart_rate ?? null;
  const hrvTxt = hrv != null ? `HRV ${Math.round(hrv)} ms` : null;
  const rhrTxt = rhr != null ? `RHR ${Math.round(rhr)} bpm` : null;
  const subtitle =
    [hrvTxt, rhrTxt].filter(Boolean).join(" · ") || (display.reason ?? "");

  const headline = display.recommendation
    ? (HEADLINES[display.recommendation] ?? display.recommendation)
    : "–";
  const mascotMood = moodFromReadinessRecommendation(display.recommendation);

  const sleepHr = today?.sleep_hours ?? healthToday?.sleep_hours ?? null;
  const sleepLbl =
    sleepHr != null && sleepHr > 0
      ? formatSleepDuration(sleepHr)
      : (sleepFactor?.value ?? "–");
  const sleepScr =
    display.sleepScore != null ? Math.round(display.sleepScore) : null;

  const loadLbl = display.recommendation
    ? (LOAD_SHORT[display.recommendation] ?? "–")
    : "–";
  const strainScr =
    display.strainScore != null ? Math.round(display.strainScore) : null;

  const fuelGrams = proteinGrams(fuelFactor);
  const fuelScr = fuelFactor != null ? Math.round(fuelFactor.score) : null;
  const fuelBad = fuelFactor?.status === "poor";
  const fuelDetail =
    fuelScr != null ? (fuelBad ? `↓ ${fuelScr}` : String(fuelScr)) : undefined;

  const fillDeg = (score / 100) * GAT;
  const trackD = arc(GAS, GAT);
  const fillD = fillDeg > 1 ? arc(GAS, fillDeg) : null;
  const tipPt = fillDeg > 1 ? degXY(GAS + fillDeg) : null;

  return (
    <GradientCard
      variant="readiness"
      palette={palette}
      accentOptions={{ readinessScore: score }}
      delay={delay}
    >
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/(tabs)/progress/recovery",
            params: returnTo != null ? { returnTo: String(returnTo) } : undefined,
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Readiness score ${score}, ${headline}`}
        style={({ pressed }) => [pressed && s.pressed]}
      >
        <View style={s.header}>
          <View style={s.headerMain}>
            <Ionicons name="pulse" size={HEADER_ICON_SIZE} color={accent.iconBg} />
            <Text style={[s.headerLabel, { color: P.textDim }]}>Readiness</Text>
          </View>
          <View style={s.headerRight}>
            <AnimatedMascot mood={mascotMood} size={44} />
            <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
          </View>
        </View>

        <View style={s.main}>
          <View style={{ width: G, height: GH, overflow: "hidden" }}>
            <Svg width={G} height={G} style={s.gaugeSvg}>
              <Path
                d={trackD}
                fill="none"
                stroke={trackClr}
                strokeWidth={GSW}
                strokeLinecap="round"
              />
              {fillD != null && (
                <Path
                  d={fillD}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth={GSW}
                  strokeLinecap="round"
                />
              )}
              {tipPt != null && (
                <Circle
                  cx={tipPt.x}
                  cy={tipPt.y}
                  r={GSW / 2}
                  fill={ringColor}
                />
              )}
            </Svg>
            <View style={s.gaugeCenter}>
              <Text style={[s.gaugeNum, { color: P.text }]}>{score}</Text>
              <Text style={[s.gaugeOf, { color: P.textFaint }]}>/100</Text>
            </View>
          </View>

          <View style={s.copy}>
            <Text style={[s.headline, { color: P.text }]} numberOfLines={1}>
              {headline}
            </Text>
            {!!subtitle && (
              <Text
                style={[s.subtitle, { color: P.textFaint }]}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        <View style={[s.divider, { backgroundColor: P.hair }]} />

        <View style={s.stats}>
          <StatCell
            label="Sleep"
            value={sleepLbl}
            detail={sleepScr != null ? String(sleepScr) : undefined}
            detailColor={ringColor}
            textColor={P.text}
            faintColor={P.textFaint}
          />
          <View style={[s.vDivider, { backgroundColor: P.hair }]} />
          <StatCell
            label="Load"
            value={loadLbl}
            detail={strainScr != null ? String(strainScr) : undefined}
            textColor={P.text}
            faintColor={P.textFaint}
          />
          <View style={[s.vDivider, { backgroundColor: P.hair }]} />
          <StatCell
            label="Fuel"
            value={fuelGrams}
            detail={fuelDetail}
            detailColor={fuelBad ? P.calories : P.textFaint}
            textColor={P.text}
            faintColor={P.textFaint}
          />
        </View>
      </Pressable>
    </GradientCard>
  );
}

const s = StyleSheet.create({
  pressed: {
    opacity: 0.88,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  headerMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: -8,
    marginBottom: -10,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  main: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 14,
  },
  gaugeSvg: {
    position: "absolute",
    top: 0,
  },
  gaugeCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeNum: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  gaugeOf: {
    fontSize: 9,
    fontWeight: "700",
    marginTop: -3,
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  headline: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  stats: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  statDetail: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minHeight: 14,
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
});
