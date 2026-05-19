import {
    BURN_ACTIVITIES,
    BurnActivityPicker,
    type BurnActivity,
} from "@/components/home/burn-activity-picker";
import { BurnCoachStrip } from "@/components/home/burn-coach-strip";
import type { CalorieBudgetPalette } from "@/components/home/CalorieBudgetCard";
import { CalorieBudgetCard } from "@/components/home/CalorieBudgetCard";
import { ReadinessWidget } from "@/components/home/ReadinessWidget";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { AppModal } from "@/components/ui/AppModal";
import { useToast } from "@/components/ui/Toast";
import { useCycle } from "@/context/cycle-context";
import { useFood } from "@/context/food-context";
import type { Workout } from "@/context/workout-context";
import { useWorkouts } from "@/context/workout-context";
import { useHealth } from "@/hooks/use-health";
import { useProfile } from "@/hooks/use-profile";
import { useNotificationInbox } from "@/hooks/use-notification-inbox";
import { useStepsTarget } from "@/hooks/use-steps-target";
import { useSummary } from "@/hooks/use-summary";
import { useTheme } from "@/hooks/use-theme";
import { useUnits } from "@/hooks/use-units";
import { getLocalDateString } from "@/utils/date";
import { calculateNutritionPlan } from "@/utils/nutrition";
import { distanceUnitLabel, distanceValue } from "@/utils/units";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    AppState,
    Easing,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ───────────────────────────────────────────────────────────────────────────────
// Palette — "Obsidian" premium theme.
// Dark is the primary canvas (deeper blue-black), with a restrained coral
// accent for calories, emerald / amber / violet for macros, and a cool sky
// for hydration. Cards carry a whisper of elevation via translucent borders
// and soft shadows — never chunky drop-shadows.
// ───────────────────────────────────────────────────────────────────────────────
function usePalette() {
  const { isDark } = useTheme();

  if (isDark) {
    return {
      bg: "#0A0B0F",
      bgGlow: "rgba(255,120,73,0.06)",
      card: "#1C1D23", // lifted from #141519 — cards now visually separate from the page bg
      cardEdge: "rgba(255,255,255,0.10)", // up from 0.06 — hairline borders are now perceptible
      sunken: "#0E0F13",
      text: "#F4F4F5",
      textDim: "#C4C4C8", // up from #A1A1AA — secondary labels pass WCAG AA on #1C1D23
      textFaint: "#909096", // up from #71717A — tertiary text (units, timestamps) now readable
      hair: "rgba(255,255,255,0.10)",

      calories: "#FF7849",
      caloriesSoft: "rgba(255,120,73,0.22)", // up from 0.14 — icon pill bgs are now clearly tinted
      caloriesTrack: "rgba(255,120,73,0.22)", // up from 0.12 — progress track grooves are visible

      protein: "#34D399",
      proteinSoft: "rgba(52,211,153,0.22)", // up from 0.14
      proteinTrack: "rgba(52,211,153,0.22)", // up from 0.14

      carbs: "#FBBF24",
      carbsSoft: "rgba(251,191,36,0.22)", // up from 0.14
      carbsTrack: "rgba(251,191,36,0.22)", // up from 0.14

      fat: "#A78BFA",
      fatSoft: "rgba(167,139,250,0.22)", // up from 0.14
      fatTrack: "rgba(167,139,250,0.22)", // up from 0.14

      water: "#38BDF8",
      waterSoft: "rgba(56,189,248,0.22)", // up from 0.14
      waterTrack: "rgba(56,189,248,0.22)", // up from 0.14

      flame: "#F97066",
      sage: "#34D399",
      isDark: true,
    };
  }

  return {
    bg: "#F6F6F8",
    bgGlow: "rgba(234,88,12,0.03)",
    card: "#FFFFFF",
    cardEdge: "rgba(15,23,42,0.06)",
    sunken: "#F1F1F4",
    text: "#09090B",
    textDim: "#52525B",
    textFaint: "#A1A1AA",
    hair: "rgba(15,23,42,0.08)",

    calories: "#EA580C",
    caloriesSoft: "rgba(234,88,12,0.10)",
    caloriesTrack: "rgba(234,88,12,0.50)",

    protein: "#10B981",
    proteinSoft: "rgba(16,185,129,0.10)",
    proteinTrack: "rgba(16,185,129,0.50)",

    carbs: "#D97706",
    carbsSoft: "rgba(217,119,6,0.10)",
    carbsTrack: "rgba(217,119,6,0.50)",

    fat: "#7C3AED",
    fatSoft: "rgba(124,58,237,0.10)",
    fatTrack: "rgba(124,58,237,0.50)",

    water: "#0EA5E9",
    waterSoft: "rgba(14,165,233,0.10)",
    waterTrack: "rgba(14,165,233,0.50)",

    flame: "#DC2626",
    sage: "#059669",
    isDark: false,
  };
}

type Palette = ReturnType<typeof usePalette>;

const MEAL_EMOJIS: Record<string, string> = {
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍽️",
  snack: "🍎",
  other: "🍴",
};

// ───────────────────────────────────────────────────────────────────────────────
// SegmentedDial — precision-instrument progress indicator.
//
// Renders `TICK_COUNT` tick marks radiating around a centre, filled in sequence
// as progress advances. The "leading" tick (the one currently being filled)
// is taller and brighter with a soft halo behind it — a live cursor that
// chases around the ring as the value animates in. This replaces the generic
// donut ring with something that reads more as an instrument than a gauge.
// ───────────────────────────────────────────────────────────────────────────────
const TICK_COUNT = 36;
const TICK_WIDTH = 2;
const TICK_HEIGHT = 7;
const TICK_FILLED_WIDTH = 4;
const TICK_FILLED_HEIGHT = 9;
const TICK_RADIUS = 2;
const LEADING_TICK_WIDTH = 5;
const LEADING_TICK_HEIGHT = 11;
const LEADING_HALO_SIZE = 14;
const LEADING_HALO_OFFSET = -2;
const TICK_TOP_INSET = 3;

function SegmentedDial({
  size,
  progress,
  trackColor,
  fillColor,
  haloColor,
  tickCount = TICK_COUNT,
  children,
}: {
  size: number;
  progress: number;
  trackColor: string;
  fillColor: string;
  haloColor: string;
  tickCount?: number;
  children?: React.ReactNode;
}) {
  const tickAngleStep = 360 / tickCount;
  const pct = Math.min(Math.max(progress, 0), 1);
  const fractional = pct * tickCount;
  const filledCount = Math.floor(fractional);
  const isComplete = pct >= 1;
  const leadingIdx = pct > 0 && !isComplete ? filledCount : -1;

  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: tickCount }).map((_, i) => {
        const isFilled = i < filledCount || isComplete;
        const isLeading = i === leadingIdx;
        const tickColor = isFilled || isLeading ? fillColor : trackColor;
        const w = isLeading
          ? LEADING_TICK_WIDTH
          : isFilled
            ? TICK_FILLED_WIDTH
            : TICK_WIDTH;
        const h = isLeading
          ? LEADING_TICK_HEIGHT
          : isFilled
            ? TICK_FILLED_HEIGHT
            : TICK_HEIGHT;

        return (
          <View
            key={i}
            pointerEvents="none"
            style={{
              position: "absolute",
              width: size,
              height: size,
              alignItems: "center",
              transform: [{ rotate: `${i * tickAngleStep}deg` }],
            }}
          >
            {isLeading && (
              <View
                style={{
                  position: "absolute",
                  top: LEADING_HALO_OFFSET,
                  width: LEADING_HALO_SIZE,
                  height: LEADING_HALO_SIZE,
                  borderRadius: LEADING_HALO_SIZE / 2,
                  backgroundColor: haloColor,
                }}
              />
            )}
            <View
              style={{
                position: "absolute",
                top: TICK_TOP_INSET,
                width: w,
                height: h,
                borderRadius: TICK_RADIUS,
                backgroundColor: tickColor,
                opacity: 1,
              }}
            />
          </View>
        );
      })}

      <View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: "center", justifyContent: "center" },
        ]}
        pointerEvents="none"
      >
        {children}
      </View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Card — the base container. One shape, three levels of elevation.
// ───────────────────────────────────────────────────────────────────────────────
function Card({
  children,
  style,
  padding = 20,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: any;
  padding?: number;
  delay?: number;
}) {
  const P = usePalette();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 620,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  return (
    <Animated.View
      style={[
        {
          backgroundColor: P.card,
          borderRadius: 24,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: P.cardEdge,
          padding,
          shadowColor: "#000",
          shadowOpacity: P.isDark ? 0.35 : 0.06,
          shadowRadius: P.isDark ? 18 : 12,
          shadowOffset: { width: 0, height: 6 },
          ...Platform.select({ android: { elevation: 2 } }),
          opacity: anim,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Animated header — subtle fade + drop on mount
// ───────────────────────────────────────────────────────────────────────────────
function AnimatedHeader({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 0],
  });

  return (
    <Animated.View
      style={[style, { opacity: anim, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Week scrubber — 7-day horizontal strip centred on today.
// ───────────────────────────────────────────────────────────────────────────────
function WeekStrip({
  selected,
  onSelect,
  P,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
  P: Palette;
}) {
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - (6 - i));
      return d;
    });
  }, []);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const today = new Date();

  return (
    <View style={weekStyles.row}>
      {days.map((d, idx) => {
        const isSel = sameDay(d, selected);
        const isToday = sameDay(d, today);
        const letter = d.toLocaleDateString(undefined, { weekday: "short" })[0];

        return (
          <WeekCell
            key={d.toDateString()}
            index={idx}
            isSel={isSel}
            isToday={isToday}
            letter={letter}
            day={d.getDate()}
            onPress={() => onSelect(d)}
            P={P}
          />
        );
      })}
    </View>
  );
}

function WeekCell({
  index,
  isSel,
  isToday,
  letter,
  day,
  onPress,
  P,
}: {
  index: number;
  isSel: boolean;
  isToday: boolean;
  letter: string;
  day: number;
  onPress: () => void;
  P: Palette;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: 90 + index * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Animated.View
      style={{ flex: 1, opacity: anim, transform: [{ translateY }, { scale }] }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          weekStyles.cell,
          {
            backgroundColor: isSel ? P.calories : P.card,
            borderColor: isSel ? P.calories : P.cardEdge,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={[weekStyles.dow, { color: isSel ? "#fff" : P.textFaint }]}>
          {letter}
        </Text>

        <Text style={[weekStyles.num, { color: isSel ? "#fff" : P.text }]}>
          {day}
        </Text>

        {isToday && !isSel && (
          <View
            style={[weekStyles.todayDot, { backgroundColor: P.calories }]}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

const weekStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
  },
  cell: {
    alignSelf: "stretch",
    aspectRatio: 0.72,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    position: "relative",
  },
  dow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  num: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  todayDot: {
    position: "absolute",
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

// ───────────────────────────────────────────────────────────────────────────────
// Cycle phase indicator — women only. Compact pill card with 4 phases, the
// active one highlighted, plus a "Day N of M" caption.
// ───────────────────────────────────────────────────────────────────────────────
const CYCLE_PHASES = [
  { key: "menstrual", label: "Menstrual", icon: "water" as const },
  { key: "follicular", label: "Follicular", icon: "leaf" as const },
  { key: "ovulation", label: "Ovulation", icon: "sunny" as const },
  { key: "luteal", label: "Luteal", icon: "moon" as const },
];

function CyclePhaseCard({ P, delay = 0 }: { P: Palette; delay?: number }) {
  const { current, history } = useCycle();

  if (!current?.phase) return null;

  const activeIndex = Math.max(
    CYCLE_PHASES.findIndex((p) => p.key === current.phase),
    0,
  );
  const phase = CYCLE_PHASES[activeIndex];
  const cycleLen = history[0]?.cycle_length ?? 28;
  const cycleDay =
    current.days_remaining != null
      ? Math.max(cycleLen - current.days_remaining, 1)
      : null;

  return (
    <Card delay={delay} padding={18}>
      <View style={styles.cycleHead}>
        <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
          <Ionicons name={phase.icon} size={16} color={P.fat} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.cycleTitle, { color: P.text }]}>
            {phase.label}{" "}
            <Text style={{ color: P.textFaint, fontWeight: "500" }}>phase</Text>
          </Text>
          <Text style={[styles.cycleSub, { color: P.textFaint }]}>
            {cycleDay != null
              ? `Day ${cycleDay} of ${cycleLen}`
              : `${cycleLen}-day cycle`}
          </Text>
        </View>
      </View>

      <View style={styles.phaseRow}>
        {CYCLE_PHASES.map((p, i) => {
          const isActive = i === activeIndex;
          return (
            <View key={p.key} style={styles.phaseTick}>
              <View
                style={[
                  styles.phaseBar,
                  {
                    backgroundColor: isActive ? P.fat : P.hair,
                    opacity: isActive ? 1 : 0.7,
                  },
                ]}
              />
              <Text
                style={[
                  styles.phaseCap,
                  {
                    color: isActive ? P.text : P.textFaint,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {p.label}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Activity card — steps, distance, active calories from HealthKit (iOS only)
// ───────────────────────────────────────────────────────────────────────────────
function ActivityCard({
  P,
  delay = 0,
  data,
}: {
  P: Palette;
  delay?: number;
  data: import("@/context/health-context").HealthData | null;
}) {
  const { profileUnit } = useUnits();
  const stepsGoal = useStepsTarget();
  const steps = data?.steps ?? 0;
  const activeCals = data?.active_calories ?? 0;
  const distance = data?.distance ?? 0;

  const stepPct = Math.min(steps / stepsGoal, 1);
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
  }, [steps, stepPct]); // eslint-disable-line react-hooks/exhaustive-deps

  const fillWidth = stepFill.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const pctLabel = Math.round(stepPct * 100);

  const distNum = distanceValue(
    distance,
    (data?.distance_unit as import("@/utils/units").DistanceUnit) ?? "km",
    profileUnit,
  );
  const distUnit = distanceUnitLabel(profileUnit);

  const stepColor = stepPct >= 1 ? P.protein : P.water;
  const stepsToGo = Math.max(stepsGoal - steps, 0);

  return (
    <Card delay={delay}>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <View style={actS.header}>
        <View>
          <Text style={[actS.eyebrow, { color: P.textFaint }]}>
            DAILY MOVEMENT
          </Text>
          <Text style={[actS.heading, { color: P.text }]}>Activity</Text>
        </View>
        <View style={[actS.sourcePill, { backgroundColor: P.waterSoft }]}>
          <Ionicons name="logo-apple" size={11} color="#EF4444" />
          <Text style={[actS.sourceLabel, { color: P.water }]}>Health</Text>
        </View>
      </View>

      {/* ── Steps hero ───────────────────────────────────────────────────── */}
      <View style={actS.stepsSection}>
        <View style={actS.stepsCountRow}>
          <Text style={[actS.stepsNum, { color: P.text }]}>
            {displayedSteps.toLocaleString()}
          </Text>
          <Text style={[actS.stepsOf, { color: P.textFaint }]}>
            {" "}
            / {stepsGoal.toLocaleString()}
          </Text>
        </View>

        <View style={actS.barRow}>
          <View
            style={[
              actS.track,
              {
                backgroundColor: P.isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <Animated.View
              style={[
                actS.fill,
                { width: fillWidth, backgroundColor: stepColor },
              ]}
            />
          </View>
          <View
            style={[
              actS.pctChip,
              { backgroundColor: stepPct >= 1 ? P.proteinSoft : P.waterSoft },
            ]}
          >
            {stepPct >= 1 ? (
              <Ionicons name="checkmark" size={11} color={P.protein} />
            ) : (
              <Text style={[actS.pctText, { color: stepColor }]}>
                {pctLabel}%
              </Text>
            )}
          </View>
        </View>

        <Text style={[actS.stepsCaption, { color: P.textFaint }]}>
          {steps >= stepsGoal
            ? "Daily step goal complete"
            : `${stepsToGo.toLocaleString()} steps to go`}
        </Text>
      </View>

      {/* ── Distance + Active cal tiles ──────────────────────────────────── */}
      <View style={[actS.tilesRow, { backgroundColor: P.sunken }]}>
        <View style={actS.tile}>
          <View style={[actS.tileIcon, { backgroundColor: P.proteinSoft }]}>
            <Ionicons name="navigate-outline" size={14} color={P.protein} />
          </View>
          <View style={actS.tileFigure}>
            <Text style={[actS.tileNum, { color: P.text }]}>{distNum}</Text>
            <Text style={[actS.tileUnit, { color: P.textFaint }]}>
              {distUnit}
            </Text>
          </View>
          <Text style={[actS.tileLbl, { color: P.textFaint }]}>distance</Text>
        </View>

        <View style={[actS.vDivider, { backgroundColor: P.hair }]} />

        <View style={actS.tile}>
          <View style={[actS.tileIcon, { backgroundColor: P.caloriesSoft }]}>
            <Ionicons name="flame-outline" size={14} color={P.calories} />
          </View>
          <View style={actS.tileFigure}>
            <Text style={[actS.tileNum, { color: P.text }]}>
              {activeCals.toLocaleString()}
            </Text>
            <Text style={[actS.tileUnit, { color: P.textFaint }]}>kcal</Text>
          </View>
          <Text style={[actS.tileLbl, { color: P.textFaint }]}>
            active burn
          </Text>
        </View>
      </View>
    </Card>
  );
}

const actS = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 3,
  },
  heading: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: "700",
  },

  stepsSection: {
    marginBottom: 14,
  },
  stepsCountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  stepsNum: {
    fontFamily: "BarlowCondensed_800ExtraBold",
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -2,
  },
  stepsOf: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
  },
  pctChip: {
    minWidth: 34,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  pctText: {
    fontSize: 10,
    fontWeight: "800",
  },
  stepsCaption: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.1,
  },

  tilesRow: {
    flexDirection: "row",
    borderRadius: 16,
    overflow: "hidden",
  },
  tile: {
    flex: 1,
    padding: 14,
    gap: 3,
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  tileFigure: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  tileNum: {
    fontFamily: "BarlowCondensed_800ExtraBold",
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: -1,
  },
  tileUnit: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.1,
    marginBottom: 1,
  },
  tileLbl: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
});

// ───────────────────────────────────────────────────────────────────────────────
// Macros — three mini rings inside a single card
// ───────────────────────────────────────────────────────────────────────────────
type MacroItem = {
  key: string;
  label: string;
  cur: number;
  goal: number;
  accent: "protein" | "carbs" | "fat";
};

const MACRO_DIAL_SIZE = 102;

function MacrosCard({
  P,
  delay = 0,
  macros,
}: {
  P: Palette;
  delay?: number;
  macros: MacroItem[];
}) {
  return (
    <Card delay={delay}>
      <SectionHead title="Macros" caption="grams today" P={P} />
      <View style={styles.macrosRow}>
        {macros.map((m, i) => (
          <MacroCell
            key={m.key}
            label={m.label}
            cur={m.cur}
            goal={m.goal}
            accent={m.accent}
            P={P}
            delay={delay + 200 + i * 100}
          />
        ))}
      </View>
    </Card>
  );
}

function MacroCell({
  label,
  cur,
  goal,
  accent,
  P,
  delay,
}: {
  label: string;
  cur: number;
  goal: number;
  accent: MacroItem["accent"];
  P: Palette;
  delay: number;
}) {
  const fill = P[accent];
  const track = P[`${accent}Track` as keyof Palette] as string;
  const soft = P[`${accent}Soft` as keyof Palette] as string;

  const target = goal > 0 ? Math.min(cur / goal, 1) : 0;
  const animated = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = animated.addListener(({ value }) => setProgress(value));
    Animated.timing(animated, {
      toValue: target,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(id);
  }, [animated, target, delay]);

  const pctLabel = Math.round(progress * 100);

  return (
    <View style={styles.macroCell}>
      <SegmentedDial
        size={MACRO_DIAL_SIZE}
        progress={progress}
        trackColor={track}
        fillColor={fill}
        haloColor={soft}
      >
        <Text style={[styles.macroCur, { color: P.text }]}>{cur}</Text>
        <View style={[styles.macroDivider, { backgroundColor: fill }]} />
        <Text style={[styles.macroOf, { color: P.textFaint }]}>OF {goal}G</Text>
      </SegmentedDial>

      <View style={[styles.macroPill, { backgroundColor: soft }]}>
        <Text style={[styles.macroPillLabel, { color: fill }]}>
          {label.toUpperCase()}
        </Text>
        <View style={[styles.macroPillDot, { backgroundColor: fill }]} />
        <Text style={[styles.macroPillPct, { color: fill }]}>{pctLabel}%</Text>
      </View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Today's meals — rows in a card
// ───────────────────────────────────────────────────────────────────────────────
function MealsCard({
  P,
  delay = 0,
  meals,
  totalCalories,
  title = "Today's Meals",
  onLogMore,
}: {
  P: Palette;
  delay?: number;
  meals: import("@/context/food-context").MealItem[];
  totalCalories: number;
  title?: string;
  onLogMore?: () => void;
}) {
  const TINT_KEYS = ["calories", "protein", "carbs", "fat"] as const;

  return (
    <Card padding={0} delay={delay}>
      <View
        style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}
      >
        <SectionHead
          title={title}
          caption={
            meals.length === 0
              ? "Nothing logged yet"
              : `${meals.length} ${meals.length === 1 ? "entry" : "entries"}  ·  ${totalCalories.toLocaleString()} kcal`
          }
          action={onLogMore ? "See all" : undefined}
          P={P}
          onAction={onLogMore}
        />
      </View>

      {meals.length === 0 ? (
        onLogMore ? (
          <Pressable
            onPress={onLogMore}
            style={({ pressed }) => [
              {
                paddingHorizontal: 20,
                paddingBottom: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="add-circle-outline" size={18} color={P.textFaint} />
            <Text
              style={{ color: P.textFaint, fontSize: 13, fontWeight: "600" }}
            >
              Log your first meal
            </Text>
          </Pressable>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Text
              style={{ color: P.textFaint, fontSize: 13, fontWeight: "600" }}
            >
              No meals logged this day
            </Text>
          </View>
        )
      ) : (
        <View>
          {meals.slice(0, 5).map((meal, i) => {
            const tintKey = TINT_KEYS[i % TINT_KEYS.length];
            const tintSoft = P[`${tintKey}Soft` as keyof Palette] as string;
            const emoji = MEAL_EMOJIS[meal.meal.toLowerCase()] ?? "🍴";

            return (
              <View key={meal.id}>
                {i > 0 && (
                  <View
                    style={[styles.mealDivider, { backgroundColor: P.hair }]}
                  />
                )}
                <Pressable
                  onPress={onLogMore}
                  style={({ pressed }) => [
                    styles.mealRow,
                    onLogMore && pressed && { backgroundColor: P.sunken },
                  ]}
                >
                  <View
                    style={[styles.mealIcon, { backgroundColor: tintSoft }]}
                  >
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      style={[styles.mealName, { color: P.text }]}
                      numberOfLines={1}
                    >
                      {meal.name}
                    </Text>
                    <Text style={[styles.mealMeta, { color: P.textFaint }]}>
                      {meal.meal} · {meal.time}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text style={[styles.mealCals, { color: P.text }]}>
                      {meal.cals}
                    </Text>
                    <Text style={[styles.mealUnit, { color: P.textFaint }]}>
                      kcal
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {onLogMore && (
        <TouchableOpacity
          onPress={onLogMore}
          activeOpacity={0.7}
          style={[styles.addMealBtn, { borderTopColor: P.hair }]}
        >
          <View
            style={[styles.addMealIcon, { backgroundColor: P.caloriesSoft }]}
          >
            <Ionicons name="add" size={16} color={P.calories} />
          </View>
          <Text style={[styles.addMealText, { color: P.text }]}>
            Log another meal
          </Text>
          <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
        </TouchableOpacity>
      )}
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Workout type icon / accent mapping
// ───────────────────────────────────────────────────────────────────────────────
const WORKOUT_CONFIG: Record<string, { icon: IoniconsName; label: string }> = {
  gym: { icon: "barbell-outline", label: "Strength" },
  running: { icon: "footsteps-outline", label: "Run" },
  cycling: { icon: "bicycle-outline", label: "Cycling" },
  hiit: { icon: "flash-outline", label: "HIIT" },
  yoga: { icon: "leaf-outline", label: "Yoga" },
  swimming: { icon: "water-outline", label: "Swimming" },
  walking: { icon: "footsteps-outline", label: "Walking" },
  rowing: { icon: "boat-outline", label: "Rowing" },
  elliptical: { icon: "reload-outline", label: "Elliptical" },
  other: { icon: "apps-outline", label: "Workout" },
};

const INTENSITY_DOTS: Record<string, number> = {
  light: 1,
  moderate: 2,
  hard: 3,
};

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ───────────────────────────────────────────────────────────────────────────────
// WorkoutCard — today's logged workout sessions
// ───────────────────────────────────────────────────────────────────────────────
function WorkoutCard({
  P,
  delay = 0,
  workouts,
  totalCaloriesBurned,
  onLogMore,
}: {
  P: Palette;
  delay?: number;
  workouts: Workout[];
  totalCaloriesBurned: number;
  onLogMore?: () => void;
}) {
  const ACCENT_CYCLE = [
    { fill: P.protein, soft: P.proteinSoft },
    { fill: P.water, soft: P.waterSoft },
    { fill: P.carbs, soft: P.carbsSoft },
    { fill: P.calories, soft: P.caloriesSoft },
    { fill: P.fat, soft: P.fatSoft },
  ] as const;

  return (
    <Card padding={0} delay={delay}>
      <View
        style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}
      >
        <SectionHead
          title="Workouts"
          caption={
            workouts.length === 0
              ? "Nothing logged yet"
              : `${workouts.length} session${workouts.length !== 1 ? "s" : ""}  ·  ${totalCaloriesBurned.toLocaleString()} kcal burned`
          }
          P={P}
        />
      </View>

      {workouts.length === 0 ? (
        onLogMore ? (
          <Pressable
            onPress={onLogMore}
            style={({ pressed }) => [
              {
                paddingHorizontal: 20,
                paddingBottom: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="add-circle-outline" size={18} color={P.textFaint} />
            <Text
              style={{ color: P.textFaint, fontSize: 13, fontWeight: "600" }}
            >
              Log your first workout
            </Text>
          </Pressable>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
            <Text
              style={{ color: P.textFaint, fontSize: 13, fontWeight: "600" }}
            >
              No workouts logged this day
            </Text>
          </View>
        )
      ) : (
        <View>
          {workouts.map((w, i) => {
            const cfg = WORKOUT_CONFIG[w.type] ?? WORKOUT_CONFIG.other;
            const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
            const dots = INTENSITY_DOTS[w.intensity ?? "moderate"] ?? 2;
            const hasSets = w.sets && w.sets.length > 0;

            return (
              <View key={w.id}>
                {i > 0 && (
                  <View
                    style={[wkStyles.divider, { backgroundColor: P.hair }]}
                  />
                )}
                <Pressable
                  onPress={onLogMore}
                  style={({ pressed }) => [
                    wkStyles.row,
                    onLogMore && pressed && { backgroundColor: P.sunken },
                  ]}
                >
                  <View
                    style={[wkStyles.iconBox, { backgroundColor: accent.soft }]}
                  >
                    <Ionicons name={cfg.icon} size={18} color={accent.fill} />
                  </View>

                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[wkStyles.name, { color: P.text }]}>
                      {cfg.label}
                    </Text>
                    <View style={wkStyles.meta}>
                      <Text style={[wkStyles.metaText, { color: P.textFaint }]}>
                        {fmtDuration(w.duration_mins)}
                      </Text>
                      {w.intensity && (
                        <>
                          <View
                            style={[
                              wkStyles.metaDot,
                              { backgroundColor: P.textFaint },
                            ]}
                          />
                          <View style={wkStyles.intensityDots}>
                            {[1, 2, 3].map((d) => (
                              <View
                                key={d}
                                style={[
                                  wkStyles.dot,
                                  {
                                    backgroundColor:
                                      d <= dots ? accent.fill : P.cardEdge,
                                  },
                                ]}
                              />
                            ))}
                          </View>
                        </>
                      )}
                      {hasSets && (
                        <>
                          <View
                            style={[
                              wkStyles.metaDot,
                              { backgroundColor: P.textFaint },
                            ]}
                          />
                          <Text
                            style={[wkStyles.metaText, { color: P.textFaint }]}
                          >
                            {w.sets.length} set{w.sets.length !== 1 ? "s" : ""}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text style={[wkStyles.cals, { color: P.text }]}>
                      {Math.round(w.calories_burned)}
                    </Text>
                    <Text style={[wkStyles.calsUnit, { color: P.textFaint }]}>
                      kcal
                    </Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {onLogMore && (
        <TouchableOpacity
          onPress={onLogMore}
          activeOpacity={0.7}
          style={[styles.addMealBtn, { borderTopColor: P.hair }]}
        >
          <View
            style={[styles.addMealIcon, { backgroundColor: P.proteinSoft }]}
          >
            <Ionicons name="add" size={16} color={P.protein} />
          </View>
          <Text style={[styles.addMealText, { color: P.text }]}>
            Log a workout
          </Text>
          <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
        </TouchableOpacity>
      )}
    </Card>
  );
}

const wkStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 11,
    fontWeight: "500",
  },
  metaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.5,
  },
  intensityDots: {
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  cals: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  calsUnit: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});

// ───────────────────────────────────────────────────────────────────────────────
// Daily Insight — distinctive gradient-accent card with sparkle icon
// ───────────────────────────────────────────────────────────────────────────────
function InsightCard({
  P,
  delay = 0,
  onPress,
}: {
  P: Palette;
  delay?: number;
  onPress: () => void;
}) {
  return (
    <Card delay={delay} style={{ overflow: "hidden" }}>
      <View
        pointerEvents="none"
        style={[styles.insightGlow, { backgroundColor: P.fatSoft }]}
      />

      <View style={styles.insightHead}>
        <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
          <Ionicons name="sparkles" size={15} color={P.fat} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.insightEyebrow, { color: P.fat }]}>
            DAILY INSIGHT
          </Text>
          <Text style={[styles.insightMeta, { color: P.textFaint }]}>
            Personalised for you
          </Text>
        </View>
      </View>

      <Text style={[styles.insightBody, { color: P.text }]}>
        Your protein dips below target every afternoon. Try a{" "}
        <Text style={{ color: P.protein, fontWeight: "700" }}>
          Greek yogurt
        </Text>{" "}
        or a{" "}
        <Text style={{ color: P.protein, fontWeight: "700" }}>
          handful of almonds
        </Text>{" "}
        around 3 PM to stay steady through dinner.
      </Text>

      <TouchableOpacity
        activeOpacity={0.8}
        style={[
          styles.insightCta,
          { backgroundColor: P.sunken, borderColor: P.cardEdge },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.insightCtaText, { color: P.text }]}>
          View daily insight
        </Text>
        <Ionicons name="arrow-forward" size={14} color={P.text} />
      </TouchableOpacity>
    </Card>
  );
}

type InsightStatusModalKind = "checkin" | "workout" | "ready";

// ───────────────────────────────────────────────────────────────────────────────
// Shared section heading
// ───────────────────────────────────────────────────────────────────────────────
function SectionHead({
  title,
  caption,
  action,
  onAction,
  P,
}: {
  title: string;
  caption?: string;
  action?: string;
  onAction?: () => void;
  P: Palette;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.sectionTitle, { color: P.text }]}>{title}</Text>
        {caption && (
          <Text style={[styles.sectionCaption, { color: P.textFaint }]}>
            {caption}
          </Text>
        )}
      </View>
      {action && (
        <TouchableOpacity activeOpacity={0.7} onPress={onAction}>
          <Text style={[styles.sectionAction, { color: P.calories }]}>
            {action}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Greeting helper
// ───────────────────────────────────────────────────────────────────────────────
function greetingFor(h = new Date().getHours()) {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ───────────────────────────────────────────────────────────────────────────────
// Screen
// ───────────────────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000;
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = "@roundfit/day_cache/";

type DayCacheEntry = {
  meals: import("@/context/food-context").MealItem[];
  workouts: Workout[];
  fetchedAt: number;
};

export default function HomeScreen() {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, avatarUrl, avatarLetter, firstName, refreshProfile } =
    useProfile();
  const {
    meals: todayMeals,
    mealGoal,
    refreshLogs,
    fetchForDate: fetchMealsForDate,
  } = useFood();
  const { today: healthToday, refresh: refreshHealth } = useHealth();
  const { refresh: refreshSummary } = useSummary();
  const toast = useToast();
  const { unreadCount } = useNotificationInbox();

  const {
    workouts: todayWorkouts,
    refreshWorkouts,
    fetchForDate: fetchWorkoutsForDate,
  } = useWorkouts();

  const [date, setDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // ── Per-day cache ──────────────────────────────────────────────────────────
  // Cache is a mutable ref (Map). Reading it synchronously during render gives
  // instant results on cache hits — no React state round-trip needed.
  // `cacheVersion` bumps when new data lands so React re-renders to pick it up.
  // Fetch functions are stored in refs so they never appear in the effect dep
  // array — the effect must ONLY re-run when the selected date changes.
  const dayCache = useRef<Map<string, DayCacheEntry>>(new Map());
  const [cacheVersion, setCacheVersion] = useState(0);
  const fetchMealsRef = useRef(fetchMealsForDate);
  const fetchWorkoutsRef = useRef(fetchWorkoutsForDate);
  fetchMealsRef.current = fetchMealsForDate;
  fetchWorkoutsRef.current = fetchWorkoutsForDate;

  const todayStr = useMemo(() => getLocalDateString(), []);
  const dateStr = useMemo(() => getLocalDateString(date), [date]);
  const isToday = dateStr === todayStr;

  // L1 memory → L2 AsyncStorage → L3 network.
  // Only re-runs when the selected date changes.
  useEffect(() => {
    if (isToday) return;

    // L1: in-memory
    const hit = dayCache.current.get(dateStr);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return;

    let cancelled = false;

    (async () => {
      // L2: AsyncStorage
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY_PREFIX + dateStr);
        if (raw && !cancelled) {
          const parsed = JSON.parse(raw) as DayCacheEntry;
          if (Date.now() - parsed.fetchedAt < STORAGE_TTL_MS) {
            dayCache.current.set(dateStr, parsed);
            setCacheVersion((v) => v + 1);
            return;
          }
        }
      } catch {}

      if (cancelled) return;

      // L3: Network
      const [histMeals, histWorkouts] = await Promise.all([
        fetchMealsRef.current(dateStr),
        fetchWorkoutsRef.current(dateStr),
      ]);
      if (cancelled) return;
      const entry: DayCacheEntry = {
        meals: histMeals,
        workouts: histWorkouts,
        fetchedAt: Date.now(),
      };
      dayCache.current.set(dateStr, entry);
      setCacheVersion((v) => v + 1);
      AsyncStorage.setItem(
        CACHE_KEY_PREFIX + dateStr,
        JSON.stringify(entry),
      ).catch(() => {});
    })();

    return () => {
      cancelled = true;
    };
  }, [dateStr, isToday]); // intentionally excludes fetch fns — they live in refs

  // Sliding-window eviction: when the day rolls over, evict the day that fell
  // off the strip (7 days ago) and write the previous today into AsyncStorage.
  useEffect(() => {
    const ref = { current: AppState.currentState };
    const sub = AppState.addEventListener("change", (next) => {
      const prev = ref.current;
      ref.current = next;
      if (!prev.match(/inactive|background/) || next !== "active") return;
      const newToday = getLocalDateString();
      if (newToday === todayStr) return; // same day, nothing to do

      // Evict the day that just fell off the left edge of the strip
      const evict = new Date();
      evict.setDate(evict.getDate() - 7);
      const evictKey = getLocalDateString(evict);
      dayCache.current.delete(evictKey);
      AsyncStorage.removeItem(CACHE_KEY_PREFIX + evictKey).catch(() => {});

      // Cache yesterday (todayStr = the previous today, now a past day)
      void (async () => {
        try {
          const [meals, workouts] = await Promise.all([
            fetchMealsRef.current(todayStr),
            fetchWorkoutsRef.current(todayStr),
          ]);
          const entry: DayCacheEntry = {
            meals,
            workouts,
            fetchedAt: Date.now(),
          };
          dayCache.current.set(todayStr, entry);
          await AsyncStorage.setItem(
            CACHE_KEY_PREFIX + todayStr,
            JSON.stringify(entry),
          );
        } catch {}
      })();
    });
    return () => sub.remove();
  }, [todayStr]);

  // Synchronous cache read — instant on cache hit, empty while fetching
  const cachedEntry = !isToday ? dayCache.current.get(dateStr) : undefined;
  const validEntry =
    cachedEntry && Date.now() - cachedEntry.fetchedAt < STORAGE_TTL_MS
      ? cachedEntry
      : null;

  // Derived display values — live context for today, cache for past days
  const meals = isToday ? todayMeals : (validEntry?.meals ?? []);
  const workouts = isToday ? todayWorkouts : (validEntry?.workouts ?? []);
  const totalCalories = useMemo(
    () => meals.reduce((s, m) => s + m.cals, 0),
    [meals],
  );
  const totalProtein = useMemo(
    () => meals.reduce((s, m) => s + (m.protein ?? 0), 0),
    [meals],
  );
  const totalCarbs = useMemo(
    () => meals.reduce((s, m) => s + (m.carbs ?? 0), 0),
    [meals],
  );
  const totalFat = useMemo(
    () => meals.reduce((s, m) => s + (m.fat ?? 0), 0),
    [meals],
  );
  const workoutCalsBurned = useMemo(
    () => workouts.reduce((s, w) => s + w.calories_burned, 0),
    [workouts],
  );
  const remaining = mealGoal - totalCalories;
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [statusModalKind, setStatusModalKind] =
    useState<InsightStatusModalKind>("ready");

  // Macro targets from the same nutrition plan used on the reveal screen
  const nutritionPlan = useMemo(() => {
    if (!profile) return null;
    return calculateNutritionPlan({
      sex: profile.sex,
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      activityLevel: profile.activityLevel,
      goal: profile.goal,
    });
  }, [profile]);

  const macros = useMemo<MacroItem[]>(
    () => [
      {
        key: "protein",
        label: "Protein",
        cur: Math.round(totalProtein),
        goal: nutritionPlan?.macros.proteinG ?? 140,
        accent: "protein",
      },
      {
        key: "carbs",
        label: "Carbs",
        cur: Math.round(totalCarbs),
        goal: nutritionPlan?.macros.carbsG ?? 250,
        accent: "carbs",
      },
      {
        key: "fat",
        label: "Fat",
        cur: Math.round(totalFat),
        goal: nutritionPlan?.macros.fatG ?? 65,
        accent: "fat",
      },
    ],
    [totalProtein, totalCarbs, totalFat, nutritionPlan],
  );

  const weightKg = profile?.weightKg ?? 70;
  const [coachActivity, setCoachActivity] = useState<BurnActivity>(
    () => BURN_ACTIVITIES.find((a) => a.id === "walk") ?? BURN_ACTIVITIES[0],
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // Burn coach — recommend burning 15% of daily goal; more if over budget.
  const coachData = useMemo(() => {
    const base = Math.round(mealGoal * 0.15);
    const over = Math.max(totalCalories - mealGoal, 0);
    const caloriesToBurn = Math.max(base + over, 80);
    const activeBurned = healthToday?.active_calories ?? 0;
    const remaining = Math.max(caloriesToBurn - activeBurned, 0);
    // minutes based on remaining calories, not total
    const minutes = Math.max(
      Math.round(remaining / ((coachActivity.met * weightKg) / 60) / 5) * 5,
      0,
    );
    return {
      caloriesToBurn: remaining,
      activity: {
        label:
          minutes > 0
            ? `${coachActivity.verb} ${minutes} min`
            : `Goal reached!`,
        icon: coachActivity.icon,
      },
      goalProgress:
        caloriesToBurn > 0 ? Math.min(activeBurned / caloriesToBurn, 1) : 0,
    };
  }, [mealGoal, totalCalories, coachActivity, weightKg, healthToday]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (isToday) {
        const today = getLocalDateString();
        await Promise.all([
          refreshLogs(today),
          refreshProfile(),
          refreshHealth(),
          refreshWorkouts(today),
          refreshSummary(),
        ]);
      } else {
        dayCache.current.delete(dateStr);
        await AsyncStorage.removeItem(CACHE_KEY_PREFIX + dateStr).catch(
          () => {},
        );
        const [histMeals, histWorkouts] = await Promise.all([
          fetchMealsForDate(dateStr),
          fetchWorkoutsForDate(dateStr),
        ]);
        const entry: DayCacheEntry = {
          meals: histMeals,
          workouts: histWorkouts,
          fetchedAt: Date.now(),
        };
        dayCache.current.set(dateStr, entry);
        AsyncStorage.setItem(
          CACHE_KEY_PREFIX + dateStr,
          JSON.stringify(entry),
        ).catch(() => {});
        setCacheVersion((v) => v + 1);
      }
    } catch {
      toast.error("Could not refresh", "Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleInsightPress = () => {
    router.push("/insights/daily");
  };

  const burnedToday = isToday
    ? (healthToday?.active_calories ?? 0)
    : workoutCalsBurned;

  const isFemale = profile?.sex === "female";

  const dayLabel = useMemo(
    () => date.toLocaleDateString(undefined, { weekday: "long" }),
    [date],
  );

  const longDate = useMemo(
    () =>
      date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [date],
  );

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 96,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={P.text}
            colors={[P.calories]}
            progressBackgroundColor={P.card}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <AnimatedHeader style={styles.header}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.eyebrow, { color: P.textFaint }]}>
              {longDate.toUpperCase()}
            </Text>
            <Text style={[styles.greeting, { color: P.text }]}>
              {greetingFor()},{"\n"}
              <Text style={{ color: P.calories }}>
                {profile?.name || firstName || "there"}
              </Text>
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.iconBtn,
                { backgroundColor: P.card, borderColor: P.cardEdge },
              ]}
              onPress={() => router.push("/notifications")}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={18} color={P.text} />
              {unreadCount > 0 && (
                <View
                  style={[
                    styles.notifDot,
                    { backgroundColor: P.calories, borderColor: P.bg },
                  ]}
                />
              )}
            </TouchableOpacity>

            <UserAvatar
              size="sm"
              avatarUrl={avatarUrl}
              avatarLetter={avatarLetter}
              accentColor={P.calories}
              fillColor={P.sunken}
            />
          </View>
        </AnimatedHeader>

        {/* ── Week strip ──────────────────────────────────────── */}
        <WeekStrip selected={date} onSelect={setDate} P={P} />

        {/* ── Content stack ───────────────────────────────────── */}
        <View style={styles.stack}>
          {isToday && isFemale && <CyclePhaseCard P={P} delay={60} />}
          <CalorieBudgetCard
            P={P as CalorieBudgetPalette}
            delay={120}
            eaten={totalCalories}
            goal={mealGoal}
            burned={burnedToday}
            stepsToday={isToday ? healthToday?.steps : undefined}
            remaining={remaining}
            earnedFromActivity={burnedToday}
          />
          {isToday && (
            <BurnCoachStrip
              caloriesToBurn={coachData.caloriesToBurn}
              activity={coachData.activity}
              goalProgress={coachData.goalProgress}
              isLive={true}
              onPress={() => setPickerOpen(true)}
            />
          )}
          {isToday && <ReadinessWidget delay={260} mode="home" />}
          {isToday && (
            <InsightCard P={P} delay={320} onPress={handleInsightPress} />
          )}
          <MacrosCard P={P} delay={360} macros={macros} />
          {isToday && Platform.OS === "ios" && (
            <ActivityCard P={P} delay={430} data={healthToday} />
          )}
          <MealsCard
            P={P}
            delay={440}
            meals={meals}
            totalCalories={totalCalories}
            title={isToday ? "Today's Meals" : `${dayLabel}'s Meals`}
            onLogMore={
              isToday ? () => router.replace("/(tabs)/log/food") : undefined
            }
          />
          <WorkoutCard
            P={P}
            delay={500}
            workouts={workouts}
            totalCaloriesBurned={workoutCalsBurned}
            onLogMore={
              isToday ? () => router.push("/(tabs)/log/workout") : undefined
            }
          />
        </View>
      </ScrollView>

      <BurnActivityPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        caloriesToBurn={coachData.caloriesToBurn}
        weightKg={weightKg}
        currentId={coachActivity.id}
        onSelect={(activity) => {
          setCoachActivity(activity);
        }}
      />

      <AppModal
        visible={isStatusModalVisible}
        onClose={() => setIsStatusModalVisible(false)}
        title={
          statusModalKind === "workout" ? "Workout Prompt" : "Insight Ready"
        }
        sheetHeight={0.4}
      >
        <View style={styles.statusModalBody}>
          <Text style={[styles.statusModalText, { color: P.text }]}>
            {statusModalKind === "workout"
              ? "Your check-in is complete. Log a workout to unlock the next insight."
              : "Everything is up to date. You can now view your weekly insight report."}
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.statusModalPrimaryBtn,
              { backgroundColor: P.calories },
            ]}
            onPress={() => {
              setIsStatusModalVisible(false);
              if (statusModalKind === "workout") {
                router.replace("/(tabs)/log/workout");
              } else {
                router.replace("/(tabs)/insights/weekly");
              }
            }}
          >
            <Text style={styles.statusModalPrimaryText}>
              {statusModalKind === "workout" ? "Log workout" : "Open report"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.statusModalSecondaryBtn}
            onPress={() => setIsStatusModalVisible(false)}
          >
            <Text
              style={[styles.statusModalSecondaryText, { color: P.textFaint }]}
            >
              Maybe later
            </Text>
          </TouchableOpacity>
        </View>
      </AppModal>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  notifDot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  // Main stack
  stack: {
    paddingHorizontal: 20,
    gap: 16,
  },

  // ── Hero: today's budget (minimalist, warm) ─────────────────────────
  // Atmospheric halo stack: two offset circles at different opacities fake a
  // soft radial gradient without pulling in a gradient library.
  haloWrap: {
    position: "absolute",
    top: 60,
    left: -120,
    width: 360,
    height: 360,
    alignItems: "center",
    justifyContent: "center",
  },
  haloOuter: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  haloInner: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },

  ledgerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  dateStamp: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 14,
    letterSpacing: 1.4,
  },
  moreBtnMini: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -6,
  },

  chipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 3,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  chipTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chipVal: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  chipLbl: {
    fontSize: 10,
    fontWeight: "600",
  },

  calRingWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
  calRingNumber: {
    fontFamily: "BarlowCondensed_800ExtraBold",
    fontSize: 52,
    lineHeight: 52,
    letterSpacing: -1.5,
    textAlign: "center",
  },
  calRingUnit: {
    fontFamily: "BarlowCondensed_700Bold",
    fontSize: 13,
    letterSpacing: 1,
    textAlign: "center",
    marginTop: 3,
  },
  calRingLabel: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 4,
  },
  calRingGoalPill: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  calRingGoalText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  earnedPill: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  earnedPillText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  statLine: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    marginTop: 16,
  },
  statNum: {
    fontFamily: "BarlowCondensed_700Bold",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  statLbl: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  statSep: {
    fontSize: 12,
    fontWeight: "700",
  },

  coachSlot: { marginTop: 0 },

  // Section heading
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sectionCaption: {
    fontSize: 12,
    fontWeight: "500",
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Macros
  macrosRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  macroCell: {
    alignItems: "center",
  },
  macroCur: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 26,
  },
  macroDivider: {
    width: 14,
    height: 1,
    marginTop: 4,
    marginBottom: 4,
    opacity: 0.45,
  },
  macroOf: {
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  macroPill: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  macroPillLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  macroPillDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.6,
  },
  macroPillPct: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    fontVariant: ["tabular-nums"],
  },

  // Cycle phase
  cycleHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  cycleTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  cycleSub: {
    fontSize: 11,
    fontWeight: "500",
  },
  phaseRow: {
    flexDirection: "row",
    gap: 6,
  },
  phaseTick: {
    flex: 1,
    gap: 6,
  },
  phaseBar: {
    height: 3,
    borderRadius: 2,
  },
  phaseCap: {
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // Hydration
  hydrationHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileSm: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  hydrationSub: {
    fontSize: 11,
    fontWeight: "500",
  },
  hydrationNum: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  hydrationCount: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  hydrationGoal: {
    fontSize: 12,
    fontWeight: "600",
  },
  dropRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dropCell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Meals
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  mealDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  mealIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  mealName: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  mealMeta: {
    fontSize: 11,
    fontWeight: "500",
  },
  mealCals: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  mealUnit: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  addMealBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addMealIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addMealText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },

  // Insight
  insightGlow: {
    position: "absolute",
    top: -60,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.8,
  },
  insightHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  insightEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  insightMeta: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  insightBody: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 22,
    letterSpacing: -0.1,
    marginBottom: 16,
  },
  insightCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  insightCtaText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Quick stats row
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  quickValue: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -1,
  },
  quickCaption: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },

  statusModalBody: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 14,
  },
  statusModalText: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
  },
  statusModalPrimaryBtn: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statusModalPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  statusModalSecondaryBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  statusModalSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Past-day read-only banner
  pastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pastBannerText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
