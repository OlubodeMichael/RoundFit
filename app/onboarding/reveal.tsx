import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { calculateNutritionPlan } from '@/utils/nutrition';
import {
  mapOnboardingActivity,
  mapOnboardingGoal,
  mapOnboardingSex,
} from '@/utils/onboarding-mapping';
import type { UserGoal, UserProfile } from '@/context/auth-context';

// ── Palette ────────────────────────────────────────────────────────────────
const BG     = '#F9F8F6';
const INK    = '#111110';
const DIM    = '#8C8880';
const RULE   = '#E6E2DA';
const ORANGE = '#F97316';

// ── Copy ───────────────────────────────────────────────────────────────────
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

// ── Screen ─────────────────────────────────────────────────────────────────
export default function RevealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string;
    goal: string; activity: string; unit: string;
  }>();
  const insets = useSafeAreaInsets();

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

  const macros = useMemo(() => [
    { key: 'protein', label: 'Protein', grams: plan.macros.proteinG },
    { key: 'carbs',   label: 'Carbs',   grams: plan.macros.carbsG   },
    { key: 'fat',     label: 'Fat',     grams: plan.macros.fatG     },
  ], [plan]);

  const [displayCals, setDisplayCals] = useState(0);

  const name         = params.name?.trim() || 'You';
  const goalLabel    = GOAL_LABEL[canonicalGoal];
  const activityText = ACTIVITY_LABEL[canonicalActivity];

  // ── Animated values ──────────────────────────────────────────────────────
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

    const t1 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(headFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headY,    { toValue: 0, duration: 420, easing: E, useNativeDriver: true }),
      ]).start();
    }, 160);

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
          ]).start(), 120);

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
    <View style={[s.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>

      {/* ── Top status ───────────────────────────────────────────── */}
      <Animated.View style={[s.topRow, { opacity: topFade }]}>
        <View style={s.readyBadge}>
          <View style={s.readyDot} />
          <Text style={s.readyText}>Plan ready</Text>
        </View>
        <Text style={s.stepText}>1 of 1</Text>
      </Animated.View>

      {/* ── Heading ──────────────────────────────────────────────── */}
      <Animated.View style={[s.headBlock, { opacity: headFade, transform: [{ translateY: headY }] }]}>
        <Text style={s.headSub}>Your daily target</Text>
        <Text style={s.headName}>{name}.</Text>
      </Animated.View>

      {/* ── Hero number ──────────────────────────────────────────── */}
      <Animated.View style={[s.heroBlock, { opacity: heroFade, transform: [{ translateY: heroY }] }]}>
        <Text style={s.calNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {displayCals.toLocaleString()}
        </Text>
        <Text style={s.calLabel}>kcal / day</Text>
      </Animated.View>

      {/* ── Body: macros + stats ─────────────────────────────────── */}
      <Animated.View style={[s.body, { opacity: bodyFade, transform: [{ translateY: bodyY }] }]}>

        {/* Macro rows */}
        <View style={s.rule} />
        {macros.map((m, i) => (
          <View key={m.key}>
            <View style={s.macroRow}>
              <Text style={s.macroLabel}>{m.label}</Text>
              <Text style={s.macroGrams}>{m.grams}<Text style={s.macroUnit}>g</Text></Text>
            </View>
            {i < macros.length - 1 && <View style={s.hairline} />}
          </View>
        ))}
        <View style={s.rule} />

        {/* BMR · TDEE · TARGET */}
        <View style={s.statsRow}>
          <StatItem label="BMR"    value={plan.bmr} />
          <View style={s.statDot} />
          <StatItem label="TDEE"   value={plan.tdee} />
          <View style={s.statDot} />
          <StatItem label="Target" value={plan.calorieBudget} accent />
        </View>

      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* ── Bottom ───────────────────────────────────────────────── */}
      <Animated.View style={[s.bottom, { opacity: bottomFade, transform: [{ translateY: bottomY }] }]}>

        {/* Profile summary */}
        <View style={s.summaryRow}>
          {[name, goalLabel, activityText].map((t, i) => (
            <View key={`${t}-${i}`} style={s.summaryItem}>
              {i > 0 && <View style={s.summaryDot} />}
              <Text style={s.summaryText} numberOfLines={1}>{t}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={s.cta}
          activeOpacity={0.84}
          onPress={() => router.push({ pathname: '/auth/sign-up', params })}
        >
          <Text style={s.ctaText}>Create my account</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={s.loginRow} activeOpacity={0.6} onPress={() => router.replace('/auth/login' as any)}>
          <Text style={s.loginText}>
            Already have an account?{'  '}
            <Text style={s.loginAccent}>Log in</Text>
          </Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function StatItem({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={s.statItem}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, accent && { color: ORANGE }]}>
        {value.toLocaleString()}
      </Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 28,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 44,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  readyText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 13,
    color: INK,
    letterSpacing: 0.1,
  },
  stepText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 12,
    color: DIM,
    letterSpacing: 0.2,
  },

  // Heading
  headBlock: {
    marginBottom: 20,
    gap: 2,
  },
  headSub: {
    fontFamily: 'Syne_700Bold',
    fontSize: 13,
    color: DIM,
    letterSpacing: 0.2,
  },
  headName: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 32,
    letterSpacing: -0.8,
    color: INK,
    lineHeight: 38,
  },

  // Hero
  heroBlock: {
    marginBottom: 40,
    gap: 4,
  },
  calNumber: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 80,
    lineHeight: 80,
    letterSpacing: -4,
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  calLabel: {
    fontFamily: 'Syne_700Bold',
    fontSize: 13,
    letterSpacing: 0.3,
    color: ORANGE,
  },

  // Body
  body: {
    gap: 0,
  },
  rule: {
    height: 1,
    backgroundColor: RULE,
  },
  hairline: {
    height: 1,
    backgroundColor: '#EFECEA',
    marginLeft: 0,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  macroLabel: {
    fontFamily: 'Syne_700Bold',
    fontSize: 15,
    color: INK,
    letterSpacing: 0.1,
  },
  macroGrams: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 16,
    color: INK,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  macroUnit: {
    fontFamily: 'Syne_700Bold',
    fontSize: 12,
    color: DIM,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 0,
  },
  statItem: {
    flex: 1,
    gap: 3,
  },
  statLabel: {
    fontFamily: 'Syne_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    color: DIM,
  },
  statValue: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 15,
    letterSpacing: -0.4,
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  statDot: {
    width: 1,
    height: 28,
    backgroundColor: RULE,
    marginHorizontal: 16,
  },

  // Bottom
  bottom: {
    gap: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: RULE,
    marginHorizontal: 8,
  },
  summaryText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 12,
    color: DIM,
    letterSpacing: 0.1,
  },

  // CTA
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: INK,
    borderRadius: 14,
    paddingVertical: 18,
  },
  ctaText: {
    fontFamily: 'Syne_700Bold',
    color: '#FFF',
    fontSize: 16,
    letterSpacing: 0.1,
  },

  // Login
  loginRow: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  loginText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 13,
    color: DIM,
  },
  loginAccent: {
    color: ORANGE,
    fontFamily: 'Syne_700Bold',
  },
});
