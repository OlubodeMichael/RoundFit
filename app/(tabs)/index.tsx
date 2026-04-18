import { useFood } from "@/hooks/use-food";
import { useProfile } from "@/hooks/use-profile";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/components/ui/Toast";
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
      bgGlow: "rgba(255,120,73,0.04)",
      card: "#141519",
      cardEdge: "rgba(255,255,255,0.06)",
      sunken: "#0E0F13",
      text: "#F4F4F5",
      textDim: "#A1A1AA",
      textFaint: "#71717A",
      hair: "rgba(255,255,255,0.08)",

      calories: "#FF7849",
      caloriesSoft: "rgba(255,120,73,0.14)",
      caloriesTrack: "rgba(255,120,73,0.12)",

      protein: "#34D399",
      proteinSoft: "rgba(52,211,153,0.14)",
      proteinTrack: "rgba(52,211,153,0.14)",

      carbs: "#FBBF24",
      carbsSoft: "rgba(251,191,36,0.14)",
      carbsTrack: "rgba(251,191,36,0.14)",

      fat: "#A78BFA",
      fatSoft: "rgba(167,139,250,0.14)",
      fatTrack: "rgba(167,139,250,0.14)",

      water: "#38BDF8",
      waterSoft: "rgba(56,189,248,0.14)",
      waterTrack: "rgba(56,189,248,0.14)",

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
    caloriesTrack: "rgba(234,88,12,0.10)",

    protein: "#10B981",
    proteinSoft: "rgba(16,185,129,0.10)",
    proteinTrack: "rgba(16,185,129,0.12)",

    carbs: "#D97706",
    carbsSoft: "rgba(217,119,6,0.10)",
    carbsTrack: "rgba(217,119,6,0.12)",

    fat: "#7C3AED",
    fatSoft: "rgba(124,58,237,0.10)",
    fatTrack: "rgba(124,58,237,0.12)",

    water: "#0EA5E9",
    waterSoft: "rgba(14,165,233,0.10)",
    waterTrack: "rgba(14,165,233,0.14)",

    flame: "#DC2626",
    sage: "#059669",
    isDark: false,
  };
}

type Palette = ReturnType<typeof usePalette>;

// ───────────────────────────────────────────────────────────────────────────────
// Mock data (wire to contexts later)
// ───────────────────────────────────────────────────────────────────────────────
const GOAL = 2100;
const EATEN = 1340;
const BURNED = 210;
const REMAINING = Math.max(0, GOAL - EATEN + BURNED);

const MACROS = [
  {
    key: "protein",
    label: "Protein",
    cur: 82,
    goal: 140,
    unit: "g",
    accent: "protein" as const,
  },
  {
    key: "carbs",
    label: "Carbs",
    cur: 160,
    goal: 220,
    unit: "g",
    accent: "carbs" as const,
  },
  {
    key: "fat",
    label: "Fat",
    cur: 38,
    goal: 65,
    unit: "g",
    accent: "fat" as const,
  },
];

const MEALS: {
  name: string;
  kind: string;
  time: string;
  cals: number;
  icon: IoniconsName;
  tint: "calories" | "protein" | "carbs" | "fat";
}[] = [
  {
    name: "Oatmeal & wild berries",
    kind: "Breakfast",
    time: "8:12 AM",
    cals: 320,
    icon: "cafe",
    tint: "carbs",
  },
  {
    name: "Grilled chicken herb wrap",
    kind: "Lunch",
    time: "12:45 PM",
    cals: 510,
    icon: "restaurant",
    tint: "protein",
  },
  {
    name: "Greek yogurt & granola",
    kind: "Snack",
    time: "3:30 PM",
    cals: 150,
    icon: "nutrition",
    tint: "fat",
  },
];

const WATER_GOAL = 8;

// ───────────────────────────────────────────────────────────────────────────────
// Ring primitives
//
// DonutRing uses the two-half-clip technique: the track is a full circle
// with a border; the progress arc is rendered as two rotated half-circles
// inside clipping wrappers. Pure Views — no SVG dependency.
// ───────────────────────────────────────────────────────────────────────────────
function DonutRing({
  size,
  thickness,
  progress,
  trackColor,
  fillColor,
}: {
  size: number;
  thickness: number;
  progress: number;
  trackColor: string;
  fillColor: string;
}) {
  const pct = Math.min(Math.max(progress, 0), 1);
  const deg = pct * 360;
  const rightDeg = Math.min(deg, 180);
  const showLeft = deg > 180;
  const leftDeg = showLeft ? deg - 180 : 0;

  const base: any = {
    position: "absolute",
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: thickness,
  };

  return (
    <View style={{ width: size, height: size }}>
      <View style={[base, { borderColor: trackColor }]} />

      <View
        style={{
          position: "absolute",
          width: size,
          height: size,
          overflow: "hidden",
          left: size / 2,
        }}
      >
        <View
          style={[
            base,
            {
              borderColor: fillColor,
              right: size / 2,
              transform: [{ rotate: `${rightDeg}deg` }],
            },
          ]}
        />
      </View>

      {showLeft && (
        <View
          style={{
            position: "absolute",
            width: size,
            height: size,
            overflow: "hidden",
            right: size / 2,
          }}
        >
          <View
            style={[
              base,
              {
                borderColor: fillColor,
                left: size / 2,
                transform: [{ rotate: `${leftDeg}deg` }],
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

// Orbital end-cap dot at the tip of the progress arc.
function EndCapDot({
  size,
  progress,
  color,
  thickness,
}: {
  size: number;
  progress: number;
  color: string;
  thickness: number;
}) {
  const angle = Math.min(Math.max(progress, 0), 1) * 360;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { transform: [{ rotate: `${angle}deg` }] },
      ]}
    >
      <View
        style={{
          alignSelf: "center",
          width: thickness + 4,
          height: thickness + 4,
          borderRadius: (thickness + 4) / 2,
          backgroundColor: color,
          marginTop: -2,
          shadowColor: color,
          shadowOpacity: 0.55,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
}

// Mini ring for macros — same approach, smaller scale, no end-cap.
function MiniRing({
  size,
  thickness,
  progress,
  trackColor,
  fillColor,
  children,
}: {
  size: number;
  thickness: number;
  progress: number;
  trackColor: string;
  fillColor: string;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <DonutRing
        size={size}
        thickness={thickness}
        progress={progress}
        trackColor={trackColor}
        fillColor={fillColor}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          {children}
        </View>
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
// Animated calorie ring card — hero of the screen
// ───────────────────────────────────────────────────────────────────────────────
const HERO_RING = 268;
const HERO_THICKNESS = 14;

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

function HeroCalorieRing({ P, delay = 0 }: { P: Palette; delay?: number }) {
  const target = Math.min(EATEN / GOAL, 1);
  const animated = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = animated.addListener(({ value }) => setProgress(value));
    Animated.timing(animated, {
      toValue: target,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animated.removeListener(id);
  }, [animated, target]);

  return (
    <Card padding={24} delay={delay} style={{ overflow: "hidden" }}>
      {/* Ambient glow halo behind the ring — stacked translucent circles */}
      <View pointerEvents="none" style={styles.glowWrap}>
        <View
          style={[
            styles.glow,
            {
              width: 360,
              height: 360,
              borderRadius: 180,
              backgroundColor: P.caloriesSoft,
              opacity: P.isDark ? 0.6 : 0.9,
            },
          ]}
        />
        <View
          style={[
            styles.glow,
            {
              width: 280,
              height: 280,
              borderRadius: 140,
              backgroundColor: P.caloriesSoft,
              opacity: P.isDark ? 0.9 : 1,
            },
          ]}
        />
      </View>

      <View style={styles.ringHeader}>
        <View style={[styles.pill, { backgroundColor: P.caloriesSoft }]}>
          <View style={[styles.pillDot, { backgroundColor: P.calories }]} />
          <Text style={[styles.pillText, { color: P.calories }]}>
            TODAY&apos;S BUDGET
          </Text>
        </View>
        <TouchableOpacity hitSlop={10} style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={18} color={P.textDim} />
        </TouchableOpacity>
      </View>

      <View style={styles.ringStage}>
        <DonutRing
          size={HERO_RING}
          thickness={HERO_THICKNESS}
          progress={progress}
          trackColor={P.caloriesTrack}
          fillColor={P.calories}
        />
        <EndCapDot
          size={HERO_RING}
          progress={progress}
          color={P.calories}
          thickness={HERO_THICKNESS}
        />

        <View style={styles.ringCentre} pointerEvents="none">
          <Text style={[styles.ringValue, { color: P.text }]}>
            {REMAINING.toLocaleString()}
          </Text>
          <Text style={[styles.ringUnit, { color: P.textFaint }]}>
            calories left
          </Text>
          <View
            style={[
              styles.ringBadge,
              { backgroundColor: P.sunken, borderColor: P.cardEdge },
            ]}
          >
            <Ionicons name="flame" size={11} color={P.calories} />
            <Text style={[styles.ringBadgeText, { color: P.textDim }]}>
              {Math.round(target * 100)}% of goal
            </Text>
          </View>
        </View>
      </View>

      {/* Stat trio */}
      <View style={[styles.statRow, { borderColor: P.hair }]}>
        <StatBlock
          icon="restaurant-outline"
          label="Eaten"
          value={EATEN.toLocaleString()}
          color={P.calories}
          P={P}
        />
        <View style={[styles.statDivider, { backgroundColor: P.hair }]} />
        <StatBlock
          icon="flash-outline"
          label="Burned"
          value={BURNED.toString()}
          color={P.sage}
          P={P}
        />
        <View style={[styles.statDivider, { backgroundColor: P.hair }]} />
        <StatBlock
          icon="trending-down-outline"
          label="Net"
          value={(EATEN - BURNED).toLocaleString()}
          color={P.text}
          P={P}
        />
      </View>
    </Card>
  );
}

function StatBlock({
  icon,
  label,
  value,
  color,
  P,
}: {
  icon: IoniconsName;
  label: string;
  value: string;
  color: string;
  P: Palette;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Ionicons name={icon} size={13} color={color} />
        <Text style={[styles.statLabel, { color: P.textFaint }]}>
          {label.toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: P.text }]}>{value}</Text>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Macros — three mini rings inside a single card
// ───────────────────────────────────────────────────────────────────────────────
function MacrosCard({ P, delay = 0 }: { P: Palette; delay?: number }) {
  return (
    <Card delay={delay}>
      <SectionHead title="Macros" caption="grams today" P={P} />
      <View style={styles.macrosRow}>
        {MACROS.map((m, i) => (
          <MacroCell
            key={m.key}
            label={m.label}
            cur={m.cur}
            goal={m.goal}
            fill={P[m.accent]}
            track={P[`${m.accent}Track` as keyof Palette] as string}
            textColor={P.text}
            faintColor={P.textFaint}
            dimColor={P.textDim}
            delay={delay + 200 + i * 100}
          />
        ))}
      </View>
    </Card>
  );
}

function MacroCell({
  label, cur, goal, fill, track, textColor, faintColor, dimColor, delay,
}: {
  label: string; cur: number; goal: number;
  fill: string; track: string;
  textColor: string; faintColor: string; dimColor: string;
  delay: number;
}) {
  const target = Math.min(cur / goal, 1);
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

  return (
    <View style={styles.macroCell}>
      <MiniRing size={86} thickness={7} progress={progress} trackColor={track} fillColor={fill}>
        <Text style={[styles.macroCur, { color: textColor }]}>{cur}</Text>
        <Text style={[styles.macroOf, { color: faintColor }]}>of {goal}g</Text>
      </MiniRing>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          marginTop: 12,
        }}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fill }} />
        <Text style={[styles.macroLabel, { color: dimColor }]}>{label}</Text>
      </View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Hydration — droplet row
// ───────────────────────────────────────────────────────────────────────────────
function HydrationCard({ P, delay = 0 }: { P: Palette; delay?: number }) {
  const [water, setWater] = useState(6);

  return (
    <Card delay={delay}>
      <View style={styles.hydrationHead}>
        <View style={[styles.iconTile, { backgroundColor: P.waterSoft }]}>
          <Ionicons name="water" size={16} color={P.water} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hydrationTitle, { color: P.text }]}>
            Water
          </Text>
        </View>
        <View style={styles.hydrationNum}>
          <Text style={[styles.hydrationCount, { color: P.water }]}>
            {water}
          </Text>
          <Text style={[styles.hydrationGoal, { color: P.textFaint }]}>
            / {WATER_GOAL}
          </Text>
        </View>
      </View>

      <View style={styles.dropRow}>
        {Array.from({ length: WATER_GOAL }).map((_, i) => {
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
function MealsCard({ P, delay = 0 }: { P: Palette; delay?: number }) {
  return (
    <Card padding={0} delay={delay}>
      <View
        style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}
      >
        <SectionHead
          title="Today's Meals"
          caption={`${MEALS.length} entries  ·  ${MEALS.reduce((a, m) => a + m.cals, 0)} kcal`}
          action="See all"
          P={P}
        />
      </View>

      <View>
        {MEALS.map((meal, i) => {
          const tint = P[meal.tint];
          const tintSoft = P[`${meal.tint}Soft` as keyof Palette] as string;

          return (
            <View key={meal.name}>
              {i > 0 && (
                <View
                  style={[styles.mealDivider, { backgroundColor: P.hair }]}
                />
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.mealRow,
                  pressed && { backgroundColor: P.sunken },
                ]}
              >
                <View style={[styles.mealIcon, { backgroundColor: tintSoft }]}>
                  <Ionicons name={meal.icon} size={18} color={tint} />
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={[styles.mealName, { color: P.text }]}
                    numberOfLines={1}
                  >
                    {meal.name}
                  </Text>
                  <Text style={[styles.mealMeta, { color: P.textFaint }]}>
                    {meal.kind} · {meal.time}
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

      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.addMealBtn, { borderTopColor: P.hair }]}
      >
        <View style={[styles.addMealIcon, { backgroundColor: P.caloriesSoft }]}>
          <Ionicons name="add" size={16} color={P.calories} />
        </View>
        <Text style={[styles.addMealText, { color: P.text }]}>
          Log another meal
        </Text>
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
      >
        <Text style={[styles.insightCtaText, { color: P.text }]}>
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
  title,
  caption,
  action,
  P,
}: {
  title: string;
  caption?: string;
  action?: string;
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
        <TouchableOpacity activeOpacity={0.7}>
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
export default function HomeScreen() {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const { profile, avatarUrl, avatarLetter, firstName, refreshProfile } = useProfile();
  const { refreshLogs } = useFood();
  const toast = useToast();

  const [date, setDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshLogs(), refreshProfile()]);
    } catch {
      toast.error('Could not refresh', 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const isFemale = profile?.sex === "female";

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
          paddingBottom: insets.bottom + 48,
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
            >
              <Ionicons name="notifications-outline" size={18} color={P.text} />
              <View
                style={[
                  styles.notifDot,
                  { backgroundColor: P.calories, borderColor: P.bg },
                ]}
              />
            </TouchableOpacity>

            <View style={[styles.avatarRing, { borderColor: P.calories }]}>
              <View style={[styles.avatar, { backgroundColor: P.sunken }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={[styles.avatarLetter, { color: P.calories }]}>
                    {avatarLetter}
                  </Text>
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
          <HeroCalorieRing P={P} delay={120} />
          <InsightCard P={P} delay={200} />
          <MacrosCard P={P} delay={280} />
          <MealsCard P={P} delay={360} />
          <HydrationCard P={P} delay={440} />
        </View>
      </ScrollView>
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

  // Hero ring
  glowWrap: {
    position: "absolute",
    top: -60,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: { position: "absolute" },
  ringHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  ringStage: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    height: HERO_RING + 24,
  },
  ringCentre: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  ringValue: {
    fontSize: 64,
    fontWeight: "800",
    letterSpacing: -2.5,
    lineHeight: 68,
  },
  ringUnit: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
    marginTop: 2,
  },
  ringBadge: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ringBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  statRow: {
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statDivider: { width: StyleSheet.hairlineWidth },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  statValue: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.6,
  },

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
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  macroOf: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
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
  quickAdds: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.1,
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
