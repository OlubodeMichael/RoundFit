import { calculateNutritionPlan } from '@/utils/nutrition';
import {
  mapOnboardingActivity,
  mapOnboardingGoal,
  mapOnboardingSex,
} from '@/utils/onboarding-mapping';
import { hasActiveUserSession, type UserGoal, type UserProfile } from '@/context/auth-context';
import { isAwaitingSignupPaywall } from '@/utils/post-signup-paywall';
import { useAuth } from '@/hooks/use-auth';
import {
  buildOnboardingProfile,
  hasOnboardingParams,
  parseOnboardingNumber,
  parseOnboardingParam,
} from '@/utils/onboarding-profile';
import {
  View, Text, StyleSheet, Animated, Easing,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

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
  const { width: scrW, height: scrH } = useWindowDimensions();
  const compact = scrH < 800;
  const {
    profileSetupPending,
    setupOAuthProfile,
    isLoading,
    status,
    user,
  } = useAuth();
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    // A just-created account is routed by the gate in `app/_layout.tsx`, which
    // sends it through the paywall on the way to the app. Redirecting here would
    // race straight past it.
    if (isAwaitingSignupPaywall()) return;
    if (hasActiveUserSession(status, user)) {
      router.replace('/(tabs)');
    }
  }, [status, user, router]);

  const canonicalGoal     = useMemo(() => mapOnboardingGoal(parseOnboardingParam(params.goal)),         [params.goal]);
  const canonicalActivity = useMemo(() => mapOnboardingActivity(parseOnboardingParam(params.activity)), [params.activity]);

  const age      = parseOnboardingNumber(params.age, 25);
  const heightCm = parseOnboardingNumber(params.height, 170);
  const weightKg = parseOnboardingNumber(params.weight, 70);

  const plan = useMemo(() => calculateNutritionPlan({
    sex:           mapOnboardingSex(parseOnboardingParam(params.sex)),
    age,
    heightCm,
    weightKg,
    activityLevel: canonicalActivity,
    goal:          canonicalGoal,
  }), [age, heightCm, weightKg, canonicalActivity, canonicalGoal, params.sex]);

  const name         = parseOnboardingParam(params.name)?.trim() || 'You';
  const canFinishOAuth = hasOnboardingParams(params);
  const oauthProfile = useMemo(() => buildOnboardingProfile(params), [params]);

  async function handleContinue() {
    if (profileSetupPending && canFinishOAuth) {
      setSavingPlan(true);
      try {
        // On success the account exists and the root gate takes over from here,
        // routing through the paywall before the home screen.
        const ok = await setupOAuthProfile(oauthProfile);
        if (ok) return;
      } finally {
        setSavingPlan(false);
      }
    }
    // Sign-up comes first: the paywall now sits *after* account creation, so it
    // is the root gate — not this screen — that presents it. Params carry the
    // collected onboarding profile through to registration.
    router.push({ pathname: '/auth/sign-up-options', params } as never);
  }
  const goalLabel    = GOAL_LABEL[canonicalGoal];
  const actLabel     = ACTIVITY_LABEL[canonicalActivity];
  const isImperial   = parseOnboardingParam(params.unit) === 'imperial';
  const weightFactor = isImperial ? 2.20462 : 1;
  const weightUnit   = isImperial ? 'lb' : 'kg';
  const weightLabel  = `${Math.round(weightKg * weightFactor)} ${weightUnit}`;
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
  const withoutRoundFitPoints = useMemo(
    () => Array.from({ length: 13 }, () => weightKg),
    [weightKg],
  );
  const projEnd   = projPoints[12];
  const projDelta = projEnd - weightKg;
  const projColor = projDelta < 0 ? '#EF4444' : '#22C55E';
  const projSign  = projDelta >= 0 ? '+' : '-';
  const displayProjDelta = Math.abs(projDelta * weightFactor);
  const projectionUnit = canonicalGoal === 'lose_weight'
    ? `${weightUnit} fat`
    : canonicalGoal === 'build_muscle'
      ? `${weightUnit} lean`
      : PROJ_UNIT[canonicalGoal];

  const [chartSize, setChartSize] = useState({
    width: scrW - 72,
    height: compact ? 62 : 140,
  });

  // Guard against any non-finite/zero budget so the hero never renders blank
  // or "NaN" (e.g. if upstream params arrive malformed).
  const calorieTarget =
    Number.isFinite(plan.calorieBudget) && plan.calorieBudget > 0
      ? Math.round(plan.calorieBudget)
      : 0;
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
  const countRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const target = calorieTarget;
    setDisplayCals(0);
    setChartReady(false);
    heroFade.setValue(0);
    heroY.setValue(10);
    bodyFade.setValue(0);
    bodyY.setValue(8);
    bottomFade.setValue(0);
    bottomY.setValue(10);

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

      const step = Math.max(1, Math.ceil(target / 50));
      let cur = 0;
      countRef.current = setInterval(() => {
        cur = Math.min(cur + step, target);
        setDisplayCals(cur);
        if (cur >= target) {
          if (countRef.current) clearInterval(countRef.current);
          countRef.current = null;
          setDisplayCals(target);
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
    }, 340);

    const tFallback = setTimeout(() => {
      setDisplayCals(prev => (prev > 0 ? prev : target));
      heroFade.setValue(1);
      heroY.setValue(0);
    }, 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tFallback);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [calorieTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.root, { paddingTop: insets.top + (compact ? 6 : 12) }]}>
      <View style={[s.content, compact && s.contentCompact]}>
        {/* ── Status row ───────────────────────────────────── */}
        <Animated.View style={[s.topRow, { opacity: topFade }]}>
          <View style={s.readyBadge}>
            <View style={s.readyDot} />
            <Text style={s.readyText}>Plan ready</Text>
          </View>
          <Text style={s.daysText}>Ready in {readyDays} days</Text>
        </Animated.View>

        {/* ── Greeting ─────────────────────────────────────── */}
        <Animated.View style={[s.intro, { opacity: headFade, transform: [{ translateY: headY }] }]}>
          <Text style={s.greeting}>Hi, {name}.</Text>
          <Text style={s.greetingSub}>Here’s the plan built from your answers.</Text>
        </Animated.View>

        {/* ── Hero number ──────────────────────────────────── */}
        {/* No `adjustsFontSizeToFit`: it blanks this large hero number on iOS
            (the bottom TARGET stat — a plain Text — renders the same value
            fine). No opacity gate either, so the number can't be hidden by an
            unfinished animation. Show the target immediately and let the
            count-up animate `displayCals` toward it. */}
        <Animated.View style={[s.heroCard, compact && s.heroCardCompact, { transform: [{ translateY: heroY }] }]}>
          <View style={s.heroHeader}>
            <Text style={s.heroEyebrow}>DAILY CALORIE TARGET</Text>
            <View style={s.readyChip}>
              <View style={s.readyChipDot} />
              <Text style={s.readyChipText}>PERSONALIZED</Text>
            </View>
          </View>

          <View style={s.targetRow}>
            <Text style={[s.calNumber, compact && s.calNumberCompact]} numberOfLines={1}>
              {(displayCals > 0 ? displayCals : calorieTarget).toLocaleString()}
            </Text>
            <View style={s.targetUnitBlock}>
              <Text style={s.calUnit}>kcal</Text>
              <Text style={s.calPerDay}>per day</Text>
            </View>
          </View>

          <View style={s.heroPills}>
            {[weightLabel, goalLabel, actLabel].map((t) => (
              <View key={t} style={s.heroPill}>
                <Text style={s.heroPillText} numberOfLines={1}>{t}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Cards ────────────────────────────────────────── */}
        <Animated.View style={[s.cards, { opacity: bodyFade, transform: [{ translateY: bodyY }] }]}>
          {/* Macro split */}
          <View style={[s.macroCard, compact && s.cardCompact]}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardLabel}>DAILY MACROS</Text>
              <Text style={s.cardHint}>Built for {goalLabel.toLowerCase()}</Text>
            </View>
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
                  <Text style={s.macroMeta}>{m.pct}% of calories</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 12-week projection */}
          <View style={[s.projectionCard, compact && s.cardCompact, compact && s.projectionCardCompact]}>
            <View style={s.cardHeaderRow}>
              <View>
                <Text style={s.cardLabel}>12-WEEK OUTLOOK</Text>
                <Text style={s.projectionTitle}>
                  {projDelta === 0 ? 'Maintain your current pace' : `${projSign}${displayProjDelta.toFixed(1)} ${projectionUnit}`}
                </Text>
              </View>
              <View style={[s.projectionBadge, { backgroundColor: `${projColor}18` }]}>
                <Text style={[s.projDelta, { color: projColor }]}>WEEK 12</Text>
              </View>
            </View>
            <View
              style={[s.chartArea, compact && s.chartAreaCompact]}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  setChartSize((current) => (
                    Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
                      ? current
                      : { width, height }
                  ));
                }
              }}
            >
              <ProjectionChart
                points={projPoints}
                comparisonPoints={withoutRoundFitPoints}
                width={chartSize.width}
                height={chartSize.height}
                displayUnit={weightUnit}
                valueMultiplier={weightFactor}
                shouldAnimate={chartReady}
              />
            </View>
            <View style={s.projFooter}>
              <Text style={s.projLabel}>Now · {(weightKg * weightFactor).toFixed(isImperial ? 0 : 1)} {weightUnit}</Text>
              <Text style={s.projLabel}>{(projEnd * weightFactor).toFixed(1)} {weightUnit} projected</Text>
            </View>
          </View>

          {/* BMR · TDEE · GOAL CHANGE */}
          <View style={s.statsRow}>
            <StatCard label="BMR" value={plan.bmr} sub="at rest" />
            <StatCard label="TDEE" value={plan.tdee} sub={ACTIVITY_MULT[canonicalActivity]} />
            <StatCard
              label="GOAL CHANGE"
              value={Math.abs(caloricDelta)}
              sub={`${caloricDelta >= 0 ? '+' : '-'} kcal`}
              dark
            />
          </View>

        </Animated.View>
      </View>

      {/* ── Continue to account creation ─────────────────── */}
      <Animated.View style={[s.bottom, { opacity: bottomFade, transform: [{ translateY: bottomY }] }]}>
        <PrimaryCTA
          disabled={savingPlan || isLoading}
          onPress={() => void handleContinue()}
          label={savingPlan
              ? 'Saving your plan…'
              : profileSetupPending && canFinishOAuth
                ? 'Save plan & continue'
                : 'Continue'}
        />
      </Animated.View>
    </View>
  );
}

// ── Projection sparkline ───────────────────────────────────────────────────
function ProjectionChart({
  points, comparisonPoints, width, height, displayUnit, valueMultiplier, shouldAnimate,
}: {
  points: number[];
  comparisonPoints: number[];
  width: number;
  height: number;
  displayUnit: string;
  valueMultiplier: number;
  shouldAnimate: boolean;
}) {
  const H   = height;
  const plotLeft = 36;
  const plotRight = width - 8;
  const verticalPad = 10;
  const axisY = H - verticalPad;
  const allPoints = [...points, ...comparisonPoints];
  const min = Math.min(...allPoints);
  const max = Math.max(...allPoints);
  const rawRange = max - min;
  const domainPad = rawRange < 0.1 ? 1 : rawRange * 0.16;
  const domainMin = min - domainPad;
  const domainMax = max + domainPad;
  const range = domainMax - domainMin;
  const n = points.length - 1;

  const xs = points.map((_, i) => plotLeft + (i / n) * (plotRight - plotLeft));
  const toY = (point: number) => axisY - ((point - domainMin) / range) * (H - verticalPad * 2);
  const ys = points.map(toY);
  const comparisonYs = comparisonPoints.map(toY);

  // Catmull-Rom → cubic bezier for a smooth curve through all points
  const buildLine = (lineYs: number[]) => {
    let path = `M ${xs[0].toFixed(1)} ${lineYs[0].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const x0 = xs[Math.max(i - 1, 0)]; const y0 = lineYs[Math.max(i - 1, 0)];
      const x1 = xs[i];                  const y1 = lineYs[i];
      const x2 = xs[i + 1];             const y2 = lineYs[i + 1];
      const x3 = xs[Math.min(i + 2, n)]; const y3 = lineYs[Math.min(i + 2, n)];
      const cp1x = x1 + (x2 - x0) / 6;  const cp1y = y1 + (y2 - y0) / 6;
      const cp2x = x2 - (x3 - x1) / 6;  const cp2y = y2 - (y3 - y1) / 6;
      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }
    return path;
  };
  const line = buildLine(ys);
  const comparisonLine = buildLine(comparisonYs);
  const area = `${line} L ${xs[n].toFixed(1)} ${axisY} L ${xs[0].toFixed(1)} ${axisY} Z`;
  const comparisonArea = `${comparisonLine} L ${xs[n].toFixed(1)} ${axisY} L ${xs[0].toFixed(1)} ${axisY} Z`;
  const planRises = ys[n] < comparisonYs[n];

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

  const rightX = xs[n];
  const yTicks = [domainMax, (domainMax + domainMin) / 2, domainMin];
  const displayedRange = rawRange * valueMultiplier;
  const formatTick = (value: number) => (
    displayedRange < 5
      ? (value * valueMultiplier).toFixed(1)
      : Math.round(value * valueMultiplier).toString()
  );
  const comparisonLabelIndex = Math.round(n * 0.46);
  const planLabelIndex = Math.round(n * 0.72);
  const clampLabelY = (y: number) => Math.max(12, Math.min(H - 12, y));
  const comparisonLabelX = xs[comparisonLabelIndex];
  const planLabelX = xs[planLabelIndex];
  const comparisonLabelY = clampLabelY(
    comparisonYs[comparisonLabelIndex] + (rawRange < 0.1 ? 13 : 0),
  );
  const planLabelY = clampLabelY(ys[planLabelIndex] - (rawRange < 0.1 ? 13 : 0));

  return (
    <Svg width={width} height={H}>
      <Defs>
        <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ORANGE} stopOpacity="0.22" />
          <Stop offset="1" stopColor={ORANGE} stopOpacity="0" />
        </SvgGradient>
        <SvgGradient id="comparisonFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9C9892" stopOpacity="0.18" />
          <Stop offset="1" stopColor="#9C9892" stopOpacity="0" />
        </SvgGradient>
      </Defs>

      <SvgText
        x={1}
        y={8}
        fontFamily="Archivo_600SemiBold"
        fontSize={8}
        fill="#9A958E"
      >
        {displayUnit.toUpperCase()}
      </SvgText>

      {yTicks.map((tick, index) => {
        const y = toY(tick);
        return (
          <G key={index}>
            <Line
              x1={plotLeft}
              y1={y}
              x2={rightX}
              y2={y}
              stroke="#111"
              strokeOpacity={index === yTicks.length - 1 ? 0.16 : 0.09}
              strokeWidth={1}
              strokeDasharray={index === yTicks.length - 1 ? undefined : '4 5'}
            />
            <SvgText
              x={plotLeft - 7}
              y={y + 3}
              textAnchor="end"
              fontFamily="Archivo_500Medium"
              fontSize={8.5}
              fill="#8F8A83"
            >
              {formatTick(tick)}
            </SvgText>
          </G>
        );
      })}

      {/* Y axis */}
      <Line x1={plotLeft} y1={verticalPad} x2={plotLeft} y2={axisY}
        stroke="#111" strokeOpacity="0.18" strokeWidth={1} />

      {/* X axis */}
      <Line x1={plotLeft} y1={axisY} x2={rightX} y2={axisY}
        stroke="#111" strokeOpacity="0.18" strokeWidth={1} />

      {planRises ? (
        <>
          <AnimatedPath d={area} fill="url(#areaFill)" fillOpacity={fillOpacity} />
          <AnimatedPath d={comparisonArea} fill="url(#comparisonFill)" fillOpacity={fillOpacity} />
        </>
      ) : (
        <>
          <AnimatedPath d={comparisonArea} fill="url(#comparisonFill)" fillOpacity={fillOpacity} />
          <AnimatedPath d={area} fill="url(#areaFill)" fillOpacity={fillOpacity} />
        </>
      )}
      <Path
        d={comparisonLine}
        stroke="#9C9892"
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
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
      <Rect
        x={comparisonLabelX - 57}
        y={comparisonLabelY - 10}
        width={114}
        height={20}
        rx={10}
        fill="#F1EFEC"
      />
      <SvgText
        x={comparisonLabelX}
        y={comparisonLabelY + 3.5}
        textAnchor="middle"
        fontFamily="Archivo_600SemiBold"
        fontSize={9.5}
        fill="#77736D"
      >
        Without RoundFit
      </SvgText>
      <Rect
        x={planLabelX - 46}
        y={planLabelY - 10}
        width={92}
        height={20}
        rx={10}
        fill="#FFF0E5"
      />
      <SvgText
        x={planLabelX}
        y={planLabelY + 3.5}
        textAnchor="middle"
        fontFamily="Archivo_600SemiBold"
        fontSize={9.5}
        fill={ORANGE}
      >
        With RoundFit
      </SvgText>
      <Circle cx={xs[0]} cy={ys[0]} r={5} fill={INK} stroke="#FFFFFF" strokeWidth={2} />
      <Circle cx={xs[n]} cy={comparisonYs[n]} r={3.5} fill="#9C9892" />
      <Circle cx={xs[n]} cy={ys[n]} r={4} fill={ORANGE} />
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
  root: { flex: 1, backgroundColor: BG },
  content: { flex: 1, paddingHorizontal: 20, gap: 10 },
  contentCompact: { gap: 7 },

  // Top row
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    minHeight:      22,
  },
  readyBadge: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  readyDot:   { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ORANGE },
  readyText:  { fontSize: 13, fontWeight: '700', color: INK, letterSpacing: 0.1 },
  daysText:   { fontSize: 12, fontWeight: '700', color: DIM, letterSpacing: 0.1 },

  // Greeting
  intro: { gap: 1 },
  greeting: { fontFamily: 'Archivo_600SemiBold', fontSize: 22, lineHeight: 27, color: INK, letterSpacing: -0.5 },
  greetingSub: { fontFamily: 'Archivo_400Regular', fontSize: 13.5, lineHeight: 19, color: DIM },

  // Hero
  heroCard: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 26,
    backgroundColor: INK,
  },
  heroCardCompact: { paddingVertical: 12 },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { fontFamily: 'Archivo_600SemiBold', fontSize: 9.5, letterSpacing: 1.25, color: ORANGE },
  readyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#292929',
  },
  readyChipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#22C55E' },
  readyChipText: { fontFamily: 'Archivo_600SemiBold', fontSize: 8, letterSpacing: 0.8, color: '#BDBDBD' },
  targetRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginVertical: 5 },
  calNumber: {
    fontFamily:    'Archivo_600SemiBold',
    fontSize:      60,
    lineHeight:    66,
    letterSpacing: -3,
    color:         '#FFFFFF',
    fontVariant:   ['tabular-nums'],
  },
  calNumberCompact: { fontSize: 52, lineHeight: 56 },
  targetUnitBlock: { paddingBottom: 7, gap: 0 },
  calUnit: { fontFamily: 'Archivo_600SemiBold', fontSize: 14, color: ORANGE },
  calPerDay: { fontFamily: 'Archivo_400Regular', fontSize: 11, color: '#777777' },
  heroPills: { flexDirection: 'row', gap: 6 },
  heroPill: { flexShrink: 1, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#292929' },
  heroPillText: { fontFamily: 'Archivo_500Medium', fontSize: 10, color: '#D7D7D7' },

  // Cards container
  cards: { flex: 1, gap: 9 },

  // Cards
  macroCard: { padding: 15, borderRadius: 22, backgroundColor: '#EEEAE5' },
  projectionCard: { flex: 1, minHeight: 170, padding: 15, borderRadius: 22, backgroundColor: '#FFFFFF' },
  projectionCardCompact: { minHeight: 125 },
  cardCompact: { paddingVertical: 11 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontFamily: 'Archivo_600SemiBold', fontSize: 9.5, letterSpacing: 1.25, color: DIM },
  cardHint: { fontFamily: 'Archivo_500Medium', fontSize: 10.5, color: '#AAA49C' },

  // Projection
  projectionTitle: { fontFamily: 'Archivo_600SemiBold', fontSize: 16, lineHeight: 20, color: INK, marginTop: 2 },
  projectionBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999 },
  projDelta: { fontFamily: 'Archivo_600SemiBold', fontSize: 9, letterSpacing: 0.7 },
  chartArea: { flex: 1, minHeight: 88, marginTop: 8 },
  chartAreaCompact: { minHeight: 48 },
  projFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  projLabel: { fontFamily: 'Archivo_500Medium', fontSize: 10, color: DIM },

  // Macro split
  macroBar: {
    flexDirection: 'row',
    height:        6,
    borderRadius:  3,
    overflow:      'hidden',
    marginTop:     10,
    gap:           2,
  },
  macroGrid:   { flexDirection: 'row', marginTop: 10, gap: 4 },
  macroDotRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  macroDot:    { width: 6, height: 6, borderRadius: 3 },
  macroName:   { fontFamily: 'Archivo_500Medium', fontSize: 10, color: DIM },
  macroGrams:  {
    fontFamily:    'Archivo_600SemiBold',
    fontSize:      17,
    color:         INK,
    letterSpacing: -0.5,
    fontVariant:   ['tabular-nums'],
  },
  macroGUnit: { fontFamily: 'Archivo_500Medium', fontSize: 11, color: DIM },
  macroMeta:  { fontFamily: 'Archivo_400Regular', fontSize: 9, color: DIM, marginTop: 1 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex:            1,
    minHeight:       66,
    backgroundColor: '#EEEAE5',
    borderRadius:    18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap:             1,
  },
  statCardDark: { backgroundColor: INK },
  statLabel: { fontFamily: 'Archivo_600SemiBold', fontSize: 8, letterSpacing: 1, color: DIM },
  statValue: {
    fontFamily:    'Archivo_600SemiBold',
    fontSize:      17,
    letterSpacing: -0.8,
    color:         INK,
    fontVariant:   ['tabular-nums'],
  },
  statSub: { fontFamily: 'Archivo_500Medium', fontSize: 9, letterSpacing: 0.1 },

  // Bottom
  bottom: { paddingHorizontal: 20 },
});
