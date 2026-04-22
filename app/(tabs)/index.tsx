import { useFood } from "@/context/food-context";
import { useProfile } from "@/hooks/use-profile";
import { useHealth } from "@/hooks/use-health";
import { useCycle } from "@/hooks/use-cycle";
import { calculateNutritionPlan } from "@/utils/nutrition";
import { useRouter } from "expo-router";
import { useToast } from "@/components/ui/Toast";
import { CyclePhaseCard } from "@/components/home/CyclePhaseCard";
import { HydrationCard } from "@/components/home/HydrationCard";
import { InsightCard } from "@/components/home/InsightCard";
import { MacrosCard, type MacroItem } from "@/components/home/MacrosCard";
import { MealsCard } from "@/components/home/MealsCard";
import { SegmentedDial } from "@/components/home/SegmentedDial";
import { WeekStrip } from "@/components/home/WeekStrip";
import { BurnCoachStrip } from "@/components/home/burn-coach-strip";
import { usePalette, type Palette } from "@/lib/log-theme";
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
  const { today: healthToday, refresh: refreshHealth } = useHealth();
  const { current: cycleData } = useCycle();
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
  const showCycleCard = isFemale && cycleData?.available === true && cycleData?.phase !== null;
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
        <WeekStrip selected={date} onSelect={setDate} />

        {/* ── Content stack ───────────────────────────────────── */}
        <View style={styles.stack}>
          {showCycleCard && cycleData && <CyclePhaseCard delay={60} current={cycleData} />}
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
          <InsightCard delay={280} />
          <MacrosCard delay={360} macros={macros} />
          {Platform.OS === 'ios' && (
            <ActivityCard P={P} delay={430} data={healthToday} />
          )}
          <MealsCard
            delay={440}
            meals={meals}
            totalCalories={totalCalories}
            onLogMore={() => router.replace('/(tabs)/log/food')}
          />
          <HydrationCard delay={520} waterGoal={waterGoal} />
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

  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sectionCaption: {
    fontSize: 12,
    fontWeight: "500",
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
