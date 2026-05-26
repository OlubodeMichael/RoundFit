import { calculateNutritionPlan } from '@/utils/nutrition';
import {
  mapOnboardingActivity,
  mapOnboardingGoal,
  mapOnboardingSex,
} from '@/utils/onboarding-mapping';
import { hasActiveUserSession, type UserGoal, type UserProfile } from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';
import {
  buildOnboardingProfile,
  hasOnboardingParams,
} from '@/utils/onboarding-profile';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
  ScrollView, useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path, Line, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ── Palette ────────────────────────────────────────────────────────────────
const BG     = '#F9F8F6';
const INK    = '#111110';
const DIM    = '#8C8880';
const ORANGE = '#F97316';

const MACRO_COLORS = {
  protein: '#22C55E',
  carbs:   '#FACC15',
  fat:     '#A78BFA',
};

// ── Labels ─────────────────────────────────────────────────────────────────
const GOAL_LABEL: Record<UserGoal, string> = {
  lose_weight:  'Lose weight',
  build_muscle: 'Build muscle',
  boost_energy: 'Boost energy',
  maintain:     'Maintain',
};

const ACTIVITY_LABEL: Record<UserProfile['activityLevel'], string> = {
  sedentary:         'Sedentary',
  lightly_active:    'Lightly active',
  moderately_active: 'Moderately active',
  very_active:       'Very active',
};

const ACTIVITY_MULT: Record<UserProfile['activityLevel'], string> = {
  sedentary:         '×1.20',
  lightly_active:    '×1.38',
  moderately_active: '×1.55',
  very_active:       '×1.73',
};

const WEEKLY_DELTA: Record<UserGoal, number> = {
  lose_weight:  -0.45,
  build_muscle:  0.25,
  boost_energy:  0,
  maintain:      0,
};

const PROJ_UNIT: Record<UserGoal, string> = {
  lose_weight:  'kg fat',
  build_muscle: 'kg lean',
  boost_energy: 'balanced',
  maintain:     'balanced',
};

function computeReadyDays(goal: UserGoal, weightKg: number): number {
  const rate = Math.abs(WEEKLY_DELTA[goal]);
  if (rate === 0) return 30;
  const target = goal === 'lose_weight' ? weightKg * 0.03 : 1.5;
  return Math.round((target / rate) * 7);
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function RevealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string;
    goal: string; activity: string; unit: string;
  }>();
  const insets          = useSafeAreaInsets();
  const { width: scrW } = useWindowDimensions();
  const {
    oauthProfilePending,
    setupOAuthProfile,
    isLoading,
    status,
    user,
  } = useAuth();
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    if (hasActiveUserSession(status, user)) {
      router.replace('/(tabs)');
    }
  }, [status, user, router]);

  const canonicalGoal     = useMemo(() => mapOnboardingGoal(params.goal),         [params.goal]);
  const canonicalActivity = useMemo(() => mapOnboardingActivity(params.activity), [params.activity]);

  const plan = useMemo(() => calculateNutritionPlan({
    sex:           mapOnboardingSex(params.sex),
    age:           Number(params.age)    || 25,
    heightCm:      Number(params.height) || 170,
    weightKg:      Number(params.weight) || 70,
    activityLevel: canonicalActivity,
    goal:          canonicalGoal,
  }), [params.sex, params.age, params.height, params.weight, canonicalActivity, canonicalGoal]);

  const weightKg     = Number(params.weight) || 70;
  const name         = params.name?.trim() || 'You';
  const canFinishOAuth = hasOnboardingParams(params);
  const oauthProfile = useMemo(() => buildOnboardingProfile(params), [params]);

  async function handleContinue() {
    if (oauthProfilePending && canFinishOAuth) {
      setSavingPlan(true);
      try {
        const ok = await setupOAuthProfile(oauthProfile);
        if (ok) return;
      } finally {
        setSavingPlan(false);
      }
    }
    router.push({ pathname: '/auth/sign-up-options', params });
  }
  const goalLabel    = GOAL_LABEL[canonicalGoal];
  const actLabel     = ACTIVITY_LABEL[canonicalActivity];
  const readyDays    = computeReadyDays(canonicalGoal, weightKg);
  const caloricDelta = plan.calorieBudget - plan.tdee;

  // Macros with percentage + kcal
  const macroData = useMemo(() => {
    const p   = plan.macros;
    const tot = plan.calorieBudget;
    return [
      { key: 'protein', label: 'Protein', grams: p.proteinG, kcal: p.proteinKcal, pct: Math.round(p.proteinKcal / tot * 100), color: MACRO_COLORS.protein },
      { key: 'carbs',   label: 'Carbs',   grams: p.carbsG,   kcal: p.carbsKcal,   pct: Math.round(p.carbsKcal   / tot * 100), color: MACRO_COLORS.carbs   },
      { key: 'fat',     label: 'Fat',     grams: p.fatG,     kcal: p.fatKcal,     pct: Math.round(p.fatKcal     / tot * 100), color: MACRO_COLORS.fat     },
    ];
  }, [plan]);

  // 12-week projection
  const weeklyDelta = WEEKLY_DELTA[canonicalGoal];
  const projPoints  = useMemo(() => {
    const total = 12 * weeklyDelta;
    return Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      // ease-out power curve: fast early progress that gradually plateaus
      const curved = Math.pow(t, 0.65);
      return weightKg + curved * total;
    });
  }, [weightKg, weeklyDelta]);
  const projEnd   = projPoints[12];
  const projDelta = projEnd - weightKg;
  const projColor = projDelta < 0 ? '#EF4444' : '#22C55E';
  const projSign  = projDelta >= 0 ? '+' : '-';

  // Chart width = screen - horizontal padding (20×2) - card padding (16×2)
  const chartW = scrW - 72;

  const [displayCals, setDisplayCals] = useState(0);
  const [chartReady, setChartReady]   = useState(false);

  // ── Animations ────────────────────────────────────────────────────────
  const topFade    = useRef(new Animated.Value(0)).current;
  const headFade   = useRef(new Animated.Value(0)).current;
  const headY      = useRef(new Animated.Value(8)).current;
  const heroFade   = useRef(new Animated.Value(0)).current;
  const heroY      = useRef(new Animated.Value(10)).current;
  const bodyFade   = useRef(new Animated.Value(0)).current;
  const bodyY      = useRef(new Animated.Value(8)).current;
  const bottomFade = useRef(new Animated.Value(0)).current;
  const bottomY    = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const E = Easing.out(Easing.cubic);
    Animated.timing(topFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const t1 = setTimeout(() => Animated.parallel([
      Animated.timing(headFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headY,    { toValue: 0, duration: 420, easing: E, useNativeDriver: true }),
    ]).start(), 160);

    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(heroFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(heroY,    { toValue: 0, duration: 440, easing: E, useNativeDriver: true }),
      ]).start();

      const target = plan.calorieBudget;
      const step   = Math.max(1, Math.ceil(target / 50));
      let cur      = 0;
      const iv = setInterval(() => {
        cur = Math.min(cur + step, target);
        setDisplayCals(cur);
        if (cur >= target) {
          clearInterval(iv);
          setTimeout(() => Animated.parallel([
            Animated.timing(bodyFade, { toValue: 1, duration: 440, useNativeDriver: true }),
            Animated.timing(bodyY,    { toValue: 0, duration: 380, easing: E, useNativeDriver: true }),
          ]).start(() => setChartReady(true)), 120);
          setTimeout(() => Animated.parallel([
            Animated.timing(bottomFade, { toValue: 1, duration: 420, useNativeDriver: true }),
            Animated.timing(bottomY,    { toValue: 0, duration: 360, easing: E, useNativeDriver: true }),
          ]).start(), 380);
        }
      }, 18);
      return () => clearInterval(iv);
    }, 340);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [plan.calorieBudget]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.root, { paddingTop: insets.top + 16 }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status row ───────────────────────────────────── */}
        <Animated.View style={[s.topRow, { opacity: topFade }]}>
          <View style={s.readyBadge}>
            <View style={s.readyDot} />
            <Text style={s.readyText}>Plan ready</Text>
          </View>
          <Text style={s.daysText}>Ready in {readyDays} days</Text>
        </Animated.View>

        {/* ── Greeting ─────────────────────────────────────── */}
        <Animated.View style={{ opacity: headFade, transform: [{ translateY: headY }], marginBottom: 10 }}>
          <Text style={s.greeting}>
            Hi, {name}.{'  '}
            <Text style={s.greetingSub}>Your daily target</Text>
          </Text>
        </Animated.View>

        {/* ── Hero number ──────────────────────────────────── */}
        <Animated.View style={[s.heroBlock, { opacity: heroFade, transform: [{ translateY: heroY }] }]}>
          <Text style={s.calNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {displayCals.toLocaleString()}
          </Text>
          <Text style={s.calLabel}>kcal / day</Text>
        </Animated.View>

        {/* ── Profile pills ────────────────────────────────── */}
        <Animated.View style={[s.pillsRow, { opacity: heroFade }]}>
          {[name, goalLabel, actLabel].map((t) => (
            <View key={t} style={s.pill}>
              <Text style={s.pillText}>{t}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Cards ────────────────────────────────────────── */}
        <Animated.View style={[s.cards, { opacity: bodyFade, transform: [{ translateY: bodyY }] }]}>

          {/* 12-week projection */}
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardLabel}>12-WEEK PROJECTION</Text>
              {projDelta !== 0 && (
                <Text style={[s.projDelta, { color: projColor }]}>
                  {projSign}{Math.abs(projDelta).toFixed(1)} {PROJ_UNIT[canonicalGoal]}
                </Text>
              )}
            </View>
            <View style={{ marginTop: 14 }}>
              <ProjectionChart points={projPoints} width={chartW} shouldAnimate={chartReady} />
            </View>
            <View style={s.projFooter}>
              <Text style={s.projLabel}>Now · {weightKg.toFixed(0)} kg</Text>
              <Text style={s.projLabel}>Wk 12 · {projEnd.toFixed(1)} kg</Text>
            </View>
          </View>

          {/* Macro split */}
          <View style={s.card}>
            <Text style={s.cardLabel}>MACRO SPLIT</Text>
            <View style={s.macroBar}>
              {macroData.map(m => (
                <View key={m.key} style={{ flex: m.pct, backgroundColor: m.color }} />
              ))}
            </View>
            <View style={s.macroGrid}>
              {macroData.map(m => (
                <View key={m.key} style={{ flex: 1 }}>
                  <View style={s.macroDotRow}>
                    <View style={[s.macroDot, { backgroundColor: m.color }]} />
                    <Text style={s.macroName}>{m.label}</Text>
                  </View>
                  <Text style={s.macroGrams}>
                    {m.grams}<Text style={s.macroGUnit}>g</Text>
                  </Text>
                  <Text style={s.macroMeta}>
                    {m.pct}% · {m.kcal.toLocaleString()} kcal
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* BMR · TDEE · TARGET */}
          <View style={s.statsRow}>
            <StatCard label="BMR"    value={plan.bmr}           sub="at rest"                                        />
            <StatCard label="TDEE"   value={plan.tdee}          sub={ACTIVITY_MULT[canonicalActivity]}               />
            <StatCard label="TARGET" value={plan.calorieBudget} sub={`${caloricDelta >= 0 ? '+' : ''}${caloricDelta}`} dark />
          </View>

        </Animated.View>

      </ScrollView>

      {/* ── Continue to account creation ─────────────────── */}
      <Animated.View style={[s.bottom, { opacity: bottomFade, transform: [{ translateY: bottomY }], paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[s.cta, { opacity: savingPlan || isLoading ? 0.6 : 1 }]}
          activeOpacity={0.84}
          disabled={savingPlan || isLoading}
          onPress={() => void handleContinue()}
        >
          <Text style={s.ctaText}>
            {savingPlan
              ? 'Saving your plan…'
              : oauthProfilePending && canFinishOAuth
                ? 'Save plan & continue'
                : 'Continue'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Projection sparkline ───────────────────────────────────────────────────
function ProjectionChart({
  points, width, shouldAnimate,
}: { points: number[]; width: number; shouldAnimate: boolean }) {
  const H   = 130;
  const pad = 8;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;
  const n = points.length - 1;

  const xs = points.map((_, i) => pad + (i / n) * (width - pad * 2));
  const ys = points.map(p =>
    range < 0.1
      ? H * 0.42
      : H - pad - ((p - min) / range) * (H - pad * 2),
  );

  // Catmull-Rom → cubic bezier for a smooth curve through all points
  let line = `M ${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const x0 = xs[Math.max(i - 1, 0)]; const y0 = ys[Math.max(i - 1, 0)];
    const x1 = xs[i];                  const y1 = ys[i];
    const x2 = xs[i + 1];             const y2 = ys[i + 1];
    const x3 = xs[Math.min(i + 2, n)]; const y3 = ys[Math.min(i + 2, n)];
    const cp1x = x1 + (x2 - x0) / 6;  const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;  const cp2y = y2 - (y3 - y1) / 6;
    line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  const area = `${line} L ${xs[n].toFixed(1)} ${H} L ${xs[0].toFixed(1)} ${H} Z`;

  const PATH_LEN    = width * 2; // upper bound on actual path length
  const dashOffset  = useRef(new Animated.Value(PATH_LEN)).current;
  const fillOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shouldAnimate) return;
    dashOffset.setValue(PATH_LEN);
    fillOpacity.setValue(0);
    Animated.timing(dashOffset, {
      toValue:         0,
      duration:        2600,
      easing:          Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start(() =>
      Animated.timing(fillOpacity, {
        toValue: 1, duration: 700, useNativeDriver: false,
      }).start(),
    );
  }, [shouldAnimate]); // eslint-disable-line react-hooks/exhaustive-deps

  const axisY  = H - pad;
  const rightX = xs[n];

  return (
    <Svg width={width} height={H}>
      <Defs>
        <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ORANGE} stopOpacity="0.22" />
          <Stop offset="1" stopColor={ORANGE} stopOpacity="0" />
        </SvgGradient>
      </Defs>

      {/* Horizontal grid lines */}
      <Line x1={0} y1={pad + (axisY - pad) * 0.33} x2={rightX} y2={pad + (axisY - pad) * 0.33}
        stroke="#111" strokeOpacity="0.10" strokeWidth={1} strokeDasharray="4 5" />
      <Line x1={0} y1={pad + (axisY - pad) * 0.66} x2={rightX} y2={pad + (axisY - pad) * 0.66}
        stroke="#111" strokeOpacity="0.10" strokeWidth={1} strokeDasharray="4 5" />

      {/* Y axis */}
      <Line x1={0} y1={0} x2={0} y2={axisY}
        stroke="#111" strokeOpacity="0.18" strokeWidth={1} />

      {/* X axis */}
      <Line x1={0} y1={axisY} x2={rightX} y2={axisY}
        stroke="#111" strokeOpacity="0.18" strokeWidth={1} />

      <AnimatedPath d={area} fill="url(#areaFill)" fillOpacity={fillOpacity} />
      <AnimatedPath
        d={line}
        stroke={ORANGE}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${PATH_LEN}`}
        strokeDashoffset={dashOffset}
      />
    </Svg>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, dark }: { label: string; value: number; sub: string; dark?: boolean }) {
  return (
    <View style={[s.statCard, dark && s.statCardDark]}>
      <Text style={[s.statLabel, dark && { color: 'rgba(255,255,255,0.5)' }]}>{label}</Text>
      <Text style={[s.statValue, dark && { color: '#FFF' }]}>{value.toLocaleString()}</Text>
      <Text style={[s.statSub,  { color: dark ? ORANGE : DIM }]}>{sub}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20 },

  // Top row
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   28,
  },
  readyBadge: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  readyDot:   { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ORANGE },
  readyText:  { fontSize: 13, fontWeight: '700', color: INK, letterSpacing: 0.1 },
  daysText:   { fontSize: 12, fontWeight: '700', color: DIM, letterSpacing: 0.1 },

  // Greeting
  greeting:    { fontSize: 19, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  greetingSub: { fontSize: 19, fontWeight: '500', color: DIM },

  // Hero
  heroBlock: { marginBottom: 20, gap: 4 },
  calNumber: {
    fontSize:      80,
    lineHeight:    80,
    letterSpacing: -4,
    fontWeight:    '900',
    color:         INK,
    fontVariant:   ['tabular-nums'],
  },
  calLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, color: ORANGE },

  // Pills
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  pill:     { backgroundColor: '#ECEAE6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '700', color: INK, letterSpacing: 0.1 },

  // Cards container
  cards: { gap: 16 },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel:     { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: DIM },

  // Projection
  projDelta:  { fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },
  projFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  projLabel:  { fontSize: 11, fontWeight: '600', color: DIM, letterSpacing: 0.1 },

  // Macro split
  macroBar: {
    flexDirection: 'row',
    height:        8,
    borderRadius:  4,
    overflow:      'hidden',
    marginTop:     16,
    gap:           2,
  },
  macroGrid:   { flexDirection: 'row', marginTop: 20, gap: 4 },
  macroDotRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  macroDot:    { width: 7, height: 7, borderRadius: 3.5 },
  macroName:   { fontSize: 10, fontWeight: '700', color: DIM, letterSpacing: 0.3 },
  macroGrams:  {
    fontSize:      18,
    fontWeight:    '800',
    color:         INK,
    letterSpacing: -0.5,
    fontVariant:   ['tabular-nums'],
  },
  macroGUnit: { fontSize: 12, fontWeight: '600', color: DIM },
  macroMeta:  { fontSize: 10, fontWeight: '500', color: DIM, letterSpacing: 0.1, marginTop: 2 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex:            1,
    backgroundColor: '#FFFFFF',
    borderRadius:    18,
    padding:         16,
    gap:             3,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.06,
    shadowRadius:    8,
    elevation:       2,
  },
  statCardDark: { backgroundColor: INK },
  statLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: DIM },
  statValue: {
    fontSize:      20,
    fontWeight:    '800',
    letterSpacing: -0.8,
    color:         INK,
    fontVariant:   ['tabular-nums'],
  },
  statSub: { fontSize: 10, fontWeight: '600', letterSpacing: 0.1 },

  // Bottom
  bottom: { gap: 12, paddingHorizontal: 20 },
  cta: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    backgroundColor: INK,
    borderRadius:    18,
    paddingVertical: 19,
  },
  ctaText:    { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
