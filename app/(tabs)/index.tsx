import { useFood } from "@/context/food-context";
import { useProfile } from "@/hooks/use-profile";
import { useHealth } from "@/hooks/use-health";
import { calculateNutritionPlan } from "@/utils/nutrition";
import { router, useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/components/ui/Toast";
import { BurnCoachStrip } from "@/components/home/burn-coach-strip";
import {
  BURN_ACTIVITIES,
  BurnActivityPicker,
  type BurnActivity,
} from "@/components/home/burn-activity-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Image,
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
      card: "#1C1D23",          // lifted from #141519 — cards now visually separate from the page bg
      cardEdge: "rgba(255,255,255,0.10)", // up from 0.06 — hairline borders are now perceptible
      sunken: "#0E0F13",
      text: "#F4F4F5",
      textDim: "#C4C4C8",       // up from #A1A1AA — secondary labels pass WCAG AA on #1C1D23
      textFaint: "#909096",     // up from #71717A — tertiary text (units, timestamps) now readable
      hair: "rgba(255,255,255,0.10)",

      calories: "#FF7849",
      caloriesSoft: "rgba(255,120,73,0.22)",  // up from 0.14 — icon pill bgs are now clearly tinted
      caloriesTrack: "rgba(255,120,73,0.22)", // up from 0.12 — progress track grooves are visible

      protein: "#34D399",
      proteinSoft: "rgba(52,211,153,0.22)",   // up from 0.14
      proteinTrack: "rgba(52,211,153,0.22)",  // up from 0.14

      carbs: "#FBBF24",
      carbsSoft: "rgba(251,191,36,0.22)",     // up from 0.14
      carbsTrack: "rgba(251,191,36,0.22)",    // up from 0.14

      fat: "#A78BFA",
      fatSoft: "rgba(167,139,250,0.22)",      // up from 0.14
      fatTrack: "rgba(167,139,250,0.22)",     // up from 0.14

      water: "#38BDF8",
      waterSoft: "rgba(56,189,248,0.22)",     // up from 0.14
      waterTrack: "rgba(56,189,248,0.22)",    // up from 0.14

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

const MEAL_ICONS: Record<string, IoniconsName> = {
  breakfast: 'cafe',
  lunch:     'restaurant',
  dinner:    'moon',
  snack:     'nutrition',
  other:     'fast-food',
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
const TICK_ANGLE_STEP = 360 / TICK_COUNT;
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
        const w = isLeading ? LEADING_TICK_WIDTH : isFilled ? TICK_FILLED_WIDTH : TICK_WIDTH;
        const h = isLeading ? LEADING_TICK_HEIGHT : isFilled ? TICK_FILLED_HEIGHT : TICK_HEIGHT;

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

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });

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

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY }] }]}>
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

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
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
  { key: 'menstrual',  label: 'Menstrual',  icon: 'water'           as const },
  { key: 'follicular', label: 'Follicular', icon: 'leaf'            as const },
  { key: 'ovulation',  label: 'Ovulation',  icon: 'sunny'           as const },
  { key: 'luteal',     label: 'Luteal',     icon: 'moon'            as const },
];
const CURRENT_PHASE_INDEX = 1;
const CYCLE_DAY  = 8;
const CYCLE_LEN  = 28;

function CyclePhaseCard({ P, delay = 0 }: { P: Palette; delay?: number }) {
  const phase = CYCLE_PHASES[CURRENT_PHASE_INDEX];

  return (
    <Card delay={delay} padding={18}>
      <View style={styles.cycleHead}>
        <View style={[styles.iconTile, { backgroundColor: P.fatSoft }]}>
          <Ionicons name={phase.icon} size={16} color={P.fat} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.cycleTitle, { color: P.text }]}>
            {phase.label} <Text style={{ color: P.textFaint, fontWeight: '500' }}>phase</Text>
          </Text>
          <Text style={[styles.cycleSub, { color: P.textFaint }]}>
            Day {CYCLE_DAY} of {CYCLE_LEN}
          </Text>
        </View>
      </View>

      <View style={styles.phaseRow}>
        {CYCLE_PHASES.map((p, i) => {
          const isActive = i === CURRENT_PHASE_INDEX;
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
                  { color: isActive ? P.text : P.textFaint, fontWeight: isActive ? '700' : '500' },
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

type HeroCoach = {
  caloriesToBurn: number;
  activity:       { label: string; icon?: IoniconsName };
  goalProgress:   number;
  isLive?:        boolean;
  onPress?:       () => void;
};

// ───────────────────────────────────────────────────────────────────────────────
// HeroBudgetLedger — today's calorie budget, stripped to essentials.
//
// Composition (top → bottom):
//   1. Date stamp
//   2. Big display number (calories remaining) + quiet subhead
//   3. One thin progress bar
//   4. One inline row of numbers: eaten · burned · net
//   5. Fused BurnCoachStrip when there's still burn to do
// No status chip, no eyebrows, no legends, no boxed stat trio.
// ───────────────────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HeroBudgetLedger({
  P,
  delay = 0,
  eaten,
  goal,
  burned,
  stepsToday,
  remaining,
  coach,
}: {
  P: Palette;
  delay?: number;
  eaten: number;
  goal: number;
  burned: number;
  /** Apple Health step count for today — shown next to burned when available. */
  stepsToday?: number;
  remaining: number;
  coach?: HeroCoach;
}) {
  const eatenPct = Math.min(eaten / Math.max(goal, 1), 1);

  const animated = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = animated.addListener(({ value }) => setProgress(value));
    Animated.timing(animated, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(id);
  }, [animated]);

  const displayed = Math.round(progress * Math.max(remaining, 0));

  const now       = useMemo(() => new Date(), []);
  const dateStamp = `${DAYS_SHORT[now.getDay()]}, ${MONTHS_SHORT[now.getMonth()]} ${now.getDate()}`;

  const isOver = eaten > goal;

  return (
    <Card padding={0} delay={delay} style={{ overflow: 'hidden' }}>
      {/* ── Ambient halo ───────────────────────────────────────── */}
      <View pointerEvents="none" style={styles.haloWrap}>
        <View style={[styles.haloOuter, { backgroundColor: P.caloriesSoft, opacity: P.isDark ? 0.45 : 0.75 }]} />
        <View style={[styles.haloInner, { backgroundColor: P.caloriesSoft, opacity: P.isDark ? 0.65 : 0.95 }]} />
      </View>

      <View style={{ padding: 22 }}>
        {/* ── Date row ─────────────────────────────────────────── */}
        <View style={styles.ledgerTop}>
          <Text style={[styles.dateStamp, { color: P.textDim }]}>{dateStamp}</Text>
          <TouchableOpacity hitSlop={10} style={styles.moreBtnMini}>
            <Ionicons name="ellipsis-horizontal" size={16} color={P.textFaint} />
          </TouchableOpacity>
        </View>

        {/* ── Calorie ring ─────────────────────────────────────── */}
        <View style={styles.calRingWrap}>
          <SegmentedDial
            size={200}
            progress={progress * eatenPct}
            trackColor={P.caloriesTrack}
            fillColor={P.calories}
            haloColor={P.caloriesSoft}
            tickCount={60}
          >
            <Text
              style={[styles.calRingNumber, { color: isOver ? P.calories : P.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {displayed.toLocaleString()}
            </Text>
            <Text style={[styles.calRingUnit, { color: P.textFaint }]}>cal</Text>
            <Text style={[styles.calRingLabel, { color: P.textFaint }]}>
              {isOver ? 'over budget' : 'remaining'}
            </Text>
            <View style={[styles.calRingGoalPill, { backgroundColor: P.hair }]}>
              <Text style={[styles.calRingGoalText, { color: isOver ? P.calories : P.textDim }]}>
                {goal.toLocaleString()} daily goal
              </Text>
            </View>
          </SegmentedDial>
        </View>

        {/* ── Stat chips ───────────────────────────────────────── */}
        <View style={styles.chipRow}>
          <View style={[styles.chip, { backgroundColor: P.proteinSoft }]}>
            <Ionicons name="restaurant" size={12} color={P.protein} />
            <Text style={[styles.chipVal, { color: P.text }]}>{eaten.toLocaleString()}</Text>
            <Text style={[styles.chipLbl, { color: P.textFaint }]}>eaten</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: P.caloriesSoft }]}>
            <Ionicons name="flame" size={12} color={P.calories} />
            <Text style={[styles.chipVal, { color: P.text }]}>{burned.toLocaleString()}</Text>
            <Text style={[styles.chipLbl, { color: P.textFaint }]}>
              burned
              {stepsToday !== undefined ? ` · ${stepsToday.toLocaleString()} steps` : ''}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: isOver ? P.caloriesSoft : P.waterSoft }]}>
            <Ionicons name="trending-up" size={12} color={isOver ? P.calories : P.water} />
            <Text style={[styles.chipVal, { color: P.text }]}>{(eaten - burned).toLocaleString()}</Text>
            <Text style={[styles.chipLbl, { color: P.textFaint }]}>net</Text>
          </View>
        </View>
      </View>

      {/* ── Burn coach ───────────────────────────────────────── */}
      {coach && (
        <BurnCoachStrip
          caloriesToBurn={coach.caloriesToBurn}
          activity={coach.activity}
          goalProgress={coach.goalProgress}
          isLive={coach.isLive ?? true}
          onPress={coach.onPress}
        />
      )}
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Activity card — steps, distance, active calories from HealthKit (iOS only)
// ───────────────────────────────────────────────────────────────────────────────
const STEPS_GOAL = 10_000;

function ActivityCard({ P, delay = 0, data }: { P: Palette; delay?: number; data: import('@/context/health-context').HealthData | null }) {
  const steps      = data?.steps ?? 0;
  const activeCals = data?.active_calories ?? 0;
  const distance   = data?.distance ?? 0;

  const stepPct  = Math.min(steps / STEPS_GOAL, 1);
  const stepFill = useRef(new Animated.Value(0)).current;
  const [displayedSteps, setDisplayedSteps] = useState(0);

  useEffect(() => {
    const countAnim = new Animated.Value(0);
    const id = countAnim.addListener(({ value }) => setDisplayedSteps(Math.round(value)));
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

  const fillWidth = stepFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const pctLabel  = Math.round(stepPct * 100);

  const distLabel = data?.distance_unit === 'km' || data?.distance_unit === 'metric'
    ? `${distance.toFixed(1)} km`
    : `${distance.toFixed(1)} mi`;

  return (
    <Card delay={delay}>
      <View style={styles.activityHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.sectionTitle, { color: P.text }]}>Activity</Text>
          <Text style={[styles.sectionCaption, { color: P.textFaint }]}>from Apple Health</Text>
        </View>
        <View style={[styles.stepsPctPill, { backgroundColor: stepPct >= 1 ? P.proteinSoft : P.waterSoft }]}>
          {stepPct >= 1 && <Ionicons name="checkmark" size={10} color={P.protein} />}
          <Text style={[styles.stepsPctText, { color: stepPct >= 1 ? P.protein : P.water }]}>
            {stepPct >= 1 ? 'Goal!' : `${pctLabel}%`}
          </Text>
        </View>
      </View>

      {/* Steps progress bar */}
      <View style={styles.stepsBarWrap}>
        <View style={styles.stepsBarTop}>
          <View style={styles.stepsBarLeft}>
            <Ionicons name="footsteps" size={13} color={P.water} />
            <Text style={[styles.stepsBarVal, { color: P.text }]}>{displayedSteps.toLocaleString()}</Text>
            <Text style={[styles.stepsBarGoal, { color: P.textFaint }]}>/ {STEPS_GOAL.toLocaleString()}</Text>
          </View>
          <Text style={[styles.stepsBarRemain, { color: P.textFaint }]}>
            {steps >= STEPS_GOAL ? 'Complete' : `${Math.max(STEPS_GOAL - steps, 0).toLocaleString()} to go`}
          </Text>
        </View>
        <View style={[styles.stepsTrack, { backgroundColor: P.hair }]}>
          <Animated.View
            style={[
              styles.stepsFill,
              { width: fillWidth, backgroundColor: stepPct >= 1 ? P.protein : P.water },
            ]}
          />
        </View>
      </View>

      <View style={styles.activityRow}>

        {/* Distance */}
        <View style={styles.activityStat}>
          <View style={[styles.activityIconBox, { backgroundColor: P.proteinSoft }]}>
            <Ionicons name="map" size={16} color={P.protein} />
          </View>
          <Text style={[styles.activityVal, { color: P.text }]}>{distLabel}</Text>
          <Text style={[styles.activityLbl, { color: P.textFaint }]}>distance</Text>
        </View>

        <View style={[styles.activityDivider, { backgroundColor: P.hair }]} />

        {/* Active calories */}
        <View style={styles.activityStat}>
          <View style={[styles.activityIconBox, { backgroundColor: P.caloriesSoft }]}>
            <Ionicons name="flame" size={16} color={P.calories} />
          </View>
          <Text style={[styles.activityVal, { color: P.text }]}>
            {activeCals.toLocaleString()}
          </Text>
          <Text style={[styles.activityLbl, { color: P.textFaint }]}>active cal</Text>
        </View>

      </View>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Macros — three mini rings inside a single card
// ───────────────────────────────────────────────────────────────────────────────
type MacroItem = { key: string; label: string; cur: number; goal: number; accent: 'protein' | 'carbs' | 'fat' };

const MACRO_DIAL_SIZE = 102;

function MacrosCard({ P, delay = 0, macros }: { P: Palette; delay?: number; macros: MacroItem[] }) {
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
  label, cur, goal, accent, P, delay,
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
        <Text style={[styles.macroOf, { color: P.textFaint }]}>
          OF {goal}G
        </Text>
      </SegmentedDial>

      <View style={[styles.macroPill, { backgroundColor: soft }]}>
        <Text style={[styles.macroPillLabel, { color: fill }]}>
          {label.toUpperCase()}
        </Text>
        <View style={[styles.macroPillDot, { backgroundColor: fill }]} />
        <Text style={[styles.macroPillPct, { color: fill }]}>
          {pctLabel}%
        </Text>
      </View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Hydration — droplet row
// ───────────────────────────────────────────────────────────────────────────────
function HydrationCard({
  P, delay = 0, waterGoal = 8,
}: { P: Palette; delay?: number; waterGoal?: number }) {
  const [water, setWater] = useState(0);

  return (
    <Card delay={delay}>
      <View style={styles.hydrationHead}>
        <View style={[styles.iconTile, { backgroundColor: P.waterSoft }]}>
          <Ionicons name="water" size={16} color={P.water} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hydrationTitle, { color: P.text }]}>Water</Text>
        </View>
        <View style={styles.hydrationNum}>
          <Text style={[styles.hydrationCount, { color: P.water }]}>{water}</Text>
          <Text style={[styles.hydrationGoal, { color: P.textFaint }]}>/ {waterGoal}</Text>
        </View>
      </View>

      <View style={styles.dropRow}>
        {Array.from({ length: waterGoal }).map((_, i) => {
          const filled = i < water;
          return (
            <Pressable
              key={i}
              onPress={() => setWater((w) => (i < w ? i : i + 1))}
              style={({ pressed }) => [
                styles.dropCell,
                {
                  backgroundColor: filled ? P.water : P.sunken,
                  borderColor: filled ? P.water : P.cardEdge,
                },
                pressed && { transform: [{ scale: 0.92 }] },
              ]}
              hitSlop={4}
            >
              <Ionicons
                name={filled ? "water" : "water-outline"}
                size={14}
                color={filled ? "#fff" : P.textFaint}
              />
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Today's meals — rows in a card
// ───────────────────────────────────────────────────────────────────────────────
function MealsCard({
  P, delay = 0, meals, totalCalories, onLogMore,
}: {
  P: Palette;
  delay?: number;
  meals: import('@/hooks/use-food').MealItem[];
  totalCalories: number;
  onLogMore: () => void;
}) {
  const TINT_KEYS = ['calories', 'protein', 'carbs', 'fat'] as const;

  return (
    <Card padding={0} delay={delay}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <SectionHead
          title="Today's Meals"
          caption={meals.length === 0
            ? 'Nothing logged yet'
            : `${meals.length} ${meals.length === 1 ? 'entry' : 'entries'}  ·  ${totalCalories.toLocaleString()} kcal`}
          action="See all"
          P={P}
          onAction={onLogMore}
        />
      </View>

      {meals.length === 0 ? (
        <Pressable
          onPress={onLogMore}
          style={({ pressed }) => [
            { paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="add-circle-outline" size={18} color={P.textFaint} />
          <Text style={{ color: P.textFaint, fontSize: 13, fontWeight: '600' }}>Log your first meal</Text>
        </Pressable>
      ) : (
        <View>
          {meals.slice(0, 5).map((meal, i) => {
            const tintKey = TINT_KEYS[i % TINT_KEYS.length];
            const tint     = P[tintKey] as string;
            const tintSoft = P[`${tintKey}Soft` as keyof Palette] as string;
            const icon     = MEAL_ICONS[meal.meal.toLowerCase()] ?? 'fast-food';

            return (
              <View key={meal.id}>
                {i > 0 && <View style={[styles.mealDivider, { backgroundColor: P.hair }]} />}
                <Pressable
                  onPress={onLogMore}
                  style={({ pressed }) => [styles.mealRow, pressed && { backgroundColor: P.sunken }]}
                >
                  <View style={[styles.mealIcon, { backgroundColor: tintSoft }]}>
                    <Ionicons name={icon} size={18} color={tint} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.mealName, { color: P.text }]} numberOfLines={1}>
                      {meal.name}
                    </Text>
                    <Text style={[styles.mealMeta, { color: P.textFaint }]}>
                      {meal.meal} · {meal.time}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={[styles.mealCals, { color: P.text }]}>{meal.cals}</Text>
                    <Text style={[styles.mealUnit, { color: P.textFaint }]}>kcal</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity
        onPress={onLogMore}
        activeOpacity={0.7}
        style={[styles.addMealBtn, { borderTopColor: P.hair }]}
      >
        <View style={[styles.addMealIcon, { backgroundColor: P.caloriesSoft }]}>
          <Ionicons name="add" size={16} color={P.calories} />
        </View>
        <Text style={[styles.addMealText, { color: P.text }]}>Log another meal</Text>
        <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
      </TouchableOpacity>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Daily Insight — distinctive gradient-accent card with sparkle icon
// ───────────────────────────────────────────────────────────────────────────────
function InsightCard({ P, delay = 0 }: { P: Palette; delay?: number }) {
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
        onPress={() => router.replace('/(tabs)/insights/weekly')}
      >
        <Text style={[styles.insightCtaText, { color: P.text }]} >
          See weekly report
        </Text>
        <Ionicons name="arrow-forward" size={14} color={P.text} />
      </TouchableOpacity>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Shared section heading
// ───────────────────────────────────────────────────────────────────────────────
function SectionHead({
  title, caption, action, onAction, P,
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
        {caption && <Text style={[styles.sectionCaption, { color: P.textFaint }]}>{caption}</Text>}
      </View>
      {action && (
        <TouchableOpacity activeOpacity={0.7} onPress={onAction}>
          <Text style={[styles.sectionAction, { color: P.calories }]}>{action}</Text>
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
export default function HomeScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, avatarUrl, avatarLetter, firstName, refreshProfile } = useProfile();
  const {
    meals, mealGoal, totalCalories, totalProtein, totalCarbs, totalFat,
    remaining, refreshLogs,
  } = useFood();
  const { today: healthToday, isConnected: healthConnected, refresh: refreshHealth } = useHealth();
  const toast = useToast();

  const [date, setDate]         = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Macro targets from the same nutrition plan used on the reveal screen
  const nutritionPlan = useMemo(() => {
    if (!profile) return null;
    return calculateNutritionPlan({
      sex:           profile.sex,
      age:           profile.age,
      heightCm:      profile.heightCm,
      weightKg:      profile.weightKg,
      activityLevel: profile.activityLevel,
      goal:          profile.goal,
    });
  }, [profile]);

  const macros = useMemo<MacroItem[]>(() => [
    { key: 'protein', label: 'Protein', cur: Math.round(totalProtein), goal: nutritionPlan?.macros.proteinG ?? 140, accent: 'protein' },
    { key: 'carbs',   label: 'Carbs',   cur: Math.round(totalCarbs),   goal: nutritionPlan?.macros.carbsG   ?? 250, accent: 'carbs'   },
    { key: 'fat',     label: 'Fat',     cur: Math.round(totalFat),     goal: nutritionPlan?.macros.fatG     ??  65, accent: 'fat'     },
  ], [totalProtein, totalCarbs, totalFat, nutritionPlan]);

  const weightKg = profile?.weightKg ?? 70;
  const [coachActivity, setCoachActivity] = useState<BurnActivity>(
    () => BURN_ACTIVITIES.find(a => a.id === 'walk') ?? BURN_ACTIVITIES[0],
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // Burn coach — recommend burning 15% of daily goal; more if over budget.
  const coachData = useMemo(() => {
    const base = Math.round(mealGoal * 0.15);
    const over = Math.max(totalCalories - mealGoal, 0);
    const caloriesToBurn = Math.max(base + over, 80);
    // minutes = cals / (MET × kg / 60)
    const minutes = Math.round(caloriesToBurn / (coachActivity.met * weightKg / 60) / 5) * 5;
    const activeBurned = healthToday?.active_calories ?? 0;
    return {
      caloriesToBurn: Math.max(caloriesToBurn - activeBurned, 0),
      activity: { label: `${coachActivity.verb} ${minutes} min`, icon: coachActivity.icon },
      goalProgress: caloriesToBurn > 0 ? Math.min(activeBurned / caloriesToBurn, 1) : 0,
    };
  }, [mealGoal, totalCalories, coachActivity, weightKg, healthToday]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshLogs(), refreshProfile(), refreshHealth()]);
    } catch {
      toast.error('Could not refresh', 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const burnedToday = healthToday?.active_calories ?? 0;
  const adjustedRemaining = remaining + burnedToday;

  const isFemale = profile?.sex === 'female';
  const waterGoal = 8; // will wire to summary context later

  const longDate = useMemo(
    () => date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    [date],
  );

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 48 }}
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
            <Text style={[styles.eyebrow, { color: P.textFaint }]}>{longDate.toUpperCase()}</Text>
            <Text style={[styles.greeting, { color: P.text }]}>
              {greetingFor()},{'\n'}
              <Text style={{ color: P.calories }}>{profile?.name || firstName || 'there'}</Text>
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.iconBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
            >
              <Ionicons name="notifications-outline" size={18} color={P.text} />
              <View style={[styles.notifDot, { backgroundColor: P.calories, borderColor: P.bg }]} />
            </TouchableOpacity>

            <View style={[styles.avatarRing, { borderColor: P.calories }]}>
              <View style={[styles.avatar, { backgroundColor: P.sunken }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={[styles.avatarLetter, { color: P.calories }]}>{avatarLetter}</Text>
                )}
              </View>
            </View>
          </View>
        </AnimatedHeader>

        {/* ── Week strip ──────────────────────────────────────── */}
        <WeekStrip selected={date} onSelect={setDate} P={P} />

        {/* ── Content stack ───────────────────────────────────── */}
        <View style={styles.stack}>
          {isFemale && <CyclePhaseCard P={P} delay={60} />}
          <HeroBudgetLedger
            P={P}
            delay={120}
            eaten={totalCalories}
            goal={mealGoal}
            burned={burnedToday}
            stepsToday={healthToday?.steps}
            remaining={adjustedRemaining}
            coach={{
              ...coachData,
              isLive: true,
              onPress: () => setPickerOpen(true),
            }}
          />
          <InsightCard P={P} delay={280} />
          <MacrosCard P={P} delay={360} macros={macros} />
          {Platform.OS === 'ios' && (
            <ActivityCard P={P} delay={430} data={healthToday} />
          )}
          <MealsCard
            P={P}
            delay={440}
            meals={meals}
            totalCalories={totalCalories}
            onLogMore={() => router.replace('/(tabs)/log/food')}
          />
          <HydrationCard P={P} delay={520} waterGoal={waterGoal} />
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
  avatarRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    padding: 2,
  },
  avatar: {
    flex: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarLetter: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },

  // Main stack
  stack: {
    paddingHorizontal: 20,
    gap: 16,
  },

  // ── Hero: today's budget (minimalist, warm) ─────────────────────────
  // Atmospheric halo stack: two offset circles at different opacities fake a
  // soft radial gradient without pulling in a gradient library.
  haloWrap: {
    position:       'absolute',
    top:            60,
    left:           -120,
    width:          360,
    height:         360,
    alignItems:     'center',
    justifyContent: 'center',
  },
  haloOuter: {
    position:     'absolute',
    width:        360,
    height:       360,
    borderRadius: 180,
  },
  haloInner: {
    position:     'absolute',
    width:        220,
    height:       220,
    borderRadius: 110,
  },

  ledgerTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   20,
  },
  dateStamp: {
    fontFamily:    'BarlowCondensed_600SemiBold',
    fontSize:      14,
    letterSpacing: 1.4,
  },
  moreBtnMini: {
    width:  24,
    height: 24,
    alignItems:     'center',
    justifyContent: 'center',
    marginRight:    -6,
  },

  chipRow: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  20,
  },
  chip: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius:   12,
  },
  chipVal: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.3,
  },
  chipLbl: {
    fontSize:   10,
    fontWeight: '600',
  },

  calRingWrap: {
    alignItems:    'center',
    marginBottom:  20,
  },
  calRingNumber: {
    fontFamily:    'BarlowCondensed_800ExtraBold',
    fontSize:      52,
    lineHeight:    52,
    letterSpacing: -1.5,
    textAlign:     'center',
  },
  calRingUnit: {
    fontFamily:    'BarlowCondensed_700Bold',
    fontSize:      13,
    letterSpacing: 1,
    textAlign:     'center',
    marginTop:     3,
  },
  calRingLabel: {
    fontSize:      11,
    fontWeight:    '500',
    textAlign:     'center',
    marginTop:     4,
  },
  calRingGoalPill: {
    marginTop:         8,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      999,
  },
  calRingGoalText: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 0.3,
    textAlign:     'center',
  },

  // Activity card
  activityHead: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  18,
  },
  stepsPctPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      999,
  },
  stepsPctText: {
    fontSize:   10,
    fontWeight: '800',
  },
  stepsBarWrap: {
    marginBottom: 20,
  },
  stepsBarTop: {
    flexDirection:  'row',
    alignItems:     'baseline',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  stepsBarLeft: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           5,
  },
  stepsBarVal: {
    fontSize:      20,
    fontWeight:    '800',
    letterSpacing: -0.5,
    fontVariant:   ['tabular-nums'],
  },
  stepsBarGoal: {
    fontSize:   12,
    fontWeight: '600',
  },
  stepsBarRemain: {
    fontSize:   11,
    fontWeight: '600',
  },
  stepsTrack: {
    height:       6,
    borderRadius: 3,
    overflow:     'hidden',
  },
  stepsFill: {
    height:       '100%',
    borderRadius: 3,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  activityStat: {
    flex:      1,
    alignItems: 'center',
    gap:        4,
  },
  activityIconBox: {
    width:          36,
    height:         36,
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   4,
  },
  activityVal: {
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: -0.4,
    fontVariant:   ['tabular-nums'],
  },
  activityLbl: {
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 0.3,
  },
  activityDivider: {
    width:          StyleSheet.hairlineWidth,
    alignSelf:      'stretch',
    marginTop:      8,
    marginBottom:   8,
  },

  statLine: {
    flexDirection: 'row',
    alignItems:    'baseline',
    flexWrap:      'wrap',
    marginTop:     16,
  },
  statNum: {
    fontFamily:    'BarlowCondensed_700Bold',
    fontSize:      15,
    letterSpacing: 0.2,
  },
  statLbl: {
    fontSize:      12,
    fontWeight:    '500',
    letterSpacing: 0.1,
  },
  statSep: {
    fontSize:   12,
    fontWeight: '700',
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
});
