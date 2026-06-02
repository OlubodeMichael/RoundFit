import {
    BURN_ACTIVITIES,
    BurnActivityPicker,
    type BurnActivity,
} from "@/components/home/burn-activity-picker";
import { BurnCoachStrip } from "@/components/home/burn-coach-strip";
import type { CalorieBudgetPalette } from "@/components/home/CalorieBudgetCard";
import { CalorieBudgetCard } from "@/components/home/CalorieBudgetCard";
import { DailyBudgetMetricsRow } from "@/components/home/DailyBudgetMetricsRow";
import { InsightCard } from "@/components/home/InsightCard";
import { MacrosCard, type MacroItem } from "@/components/home/MacrosCard";
import { MealsCard } from "@/components/home/MealsCard";
import { ReadinessWidget } from "@/components/home/ReadinessWidget";
import { WorkoutCard } from "@/components/home/WorkoutCard";
import { UserAvatar } from "@/components/profile/UserAvatar";
import { AppModal } from "@/components/ui/AppModal";
import { useToast } from "@/components/ui/Toast";
import { useCycle } from "@/context/cycle-context";
import { useFood } from "@/context/food-context";
import { useInsights } from "@/context/insights-context";
import { useWorkouts } from "@/context/workout-context";
import { useDayLogs } from "@/hooks/use-day-logs";
import { useHealth } from "@/hooks/use-health";
import { useProfile } from "@/hooks/use-profile";
import { useNotificationInbox } from "@/hooks/use-notification-inbox";
import { useSummary } from "@/hooks/use-summary";
import { useTheme } from "@/hooks/use-theme";
import { useWorkoutLiveActivity } from "@/hooks/use-workout-live-activity";
import { getLocalDateString } from "@/utils/date";
import { calculateNutritionPlan } from "@/utils/nutrition";
import { HydrationCard } from "@/components/home/HydrationCard";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
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


type InsightStatusModalKind = "checkin" | "workout" | "ready";

// ───────────────────────────────────────────────────────────────────────────────
// Greeting helper
// ───────────────────────────────────────────────────────────────────────────────
function greetingFor(h = new Date().getHours()) {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function offsetDateString(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

// ───────────────────────────────────────────────────────────────────────────────
// Screen
// ───────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const P = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, avatarUrl, avatarLetter, firstName, refreshProfile } =
    useProfile();
  const { mealGoal, refreshLogs, fetchForDate: fetchMealsForDate } = useFood();
  const { today: healthToday, refresh: refreshHealth } = useHealth();
  const { refresh: refreshSummary } = useSummary();
  const { ensureLoaded: ensureInsightsLoaded } = useInsights();
  const toast = useToast();
  const { unreadCount } = useNotificationInbox();

  const { refreshWorkouts, fetchForDate: fetchWorkoutsForDate } = useWorkouts();

  const [date, setDate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const todayStr = useMemo(() => getLocalDateString(), []);
  const dateStr = useMemo(() => getLocalDateString(date), [date]);
  const isToday = dateStr === todayStr;

  const { meals, workouts, refresh: refreshDayLogs } = useDayLogs(dateStr);

  // Prefetch adjacent days (resource cache, no force).
  useEffect(() => {
    const prev = offsetDateString(dateStr, -1);
    const next = offsetDateString(dateStr, 1);
    void fetchMealsForDate(prev);
    void fetchWorkoutsForDate(prev);
    if (next <= todayStr) {
      void fetchMealsForDate(next);
      void fetchWorkoutsForDate(next);
    }
  }, [dateStr, todayStr, fetchMealsForDate, fetchWorkoutsForDate]);

  // Load insights on home screen mount so the insight card shows real data
  // even if the Insights tab has never been opened.
  useEffect(() => {
    void ensureInsightsLoaded();
  }, [ensureInsightsLoaded]);
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
  const [statusModalKind] = useState<InsightStatusModalKind>("ready");

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

  // Live Activity (iOS Lock Screen / Dynamic Island workout widget)
  const {
    active:  liveWorkout,
    start:   startLiveWorkout,
    pause:   pauseLiveWorkout,
    resume:  resumeLiveWorkout,
    end:     endLiveWorkout,
  } = useWorkoutLiveActivity();

  // Calories burned during the live workout (delta from baseline at start)
  const liveBurned = liveWorkout
    ? Math.max(
        0,
        (healthToday?.active_calories ?? liveWorkout.baselineCals) -
          liveWorkout.baselineCals,
      )
    : 0;

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
        await refreshDayLogs();
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

            <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
              <UserAvatar
                size="sm"
                avatarUrl={avatarUrl}
                avatarLetter={avatarLetter}
                accentColor={P.calories}
                fillColor={P.sunken}
              />
            </Pressable>
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
            remaining={remaining}
            earnedFromActivity={burnedToday}
          />
          <DailyBudgetMetricsRow
            P={P}
            delay={160}
            eaten={totalCalories}
            goal={mealGoal}
            burned={burnedToday}
            healthData={healthToday}
            showMovement={isToday && Platform.OS === "ios"}
          />
          {isToday && (
            <BurnCoachStrip
              caloriesToBurn={coachData.caloriesToBurn}
              activity={
                liveWorkout
                  ? { label: liveWorkout.activity.label, icon: liveWorkout.activity.icon }
                  : coachData.activity
              }
              goalProgress={coachData.goalProgress}
              isLive={true}
              activeStartedAt={liveWorkout?.startedAt ?? null}
              activeCaloriesBurned={liveBurned}
              activePausedAt={liveWorkout?.pausedAt ?? null}
              onPress={() => setPickerOpen(true)}
              onStart={() => {
                if (!liveWorkout) {
                  void startLiveWorkout(coachActivity, coachData.caloriesToBurn);
                }
              }}
              onPause={() => void pauseLiveWorkout()}
              onResume={() => void resumeLiveWorkout()}
              onEnd={() => void endLiveWorkout()}
            />
          )}
          {isToday && <ReadinessWidget delay={260} />}
          {isToday && (
            <InsightCard P={P} delay={320} onPress={handleInsightPress} />
          )}
          <MacrosCard P={P} delay={360} macros={macros} />
          {isToday && (
            <HydrationCard
              P={P}
              delay={430}
              onViewAll={() => router.push("/(tabs)/log/water")}
            />
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
        onSelect={(activity) => setCoachActivity(activity)}
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
