import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

// ── Data ───────────────────────────────────────────────────────────────────

const TARGET_CALS = 1847;

const RAW_MACROS = [
  { label: 'Protein', grams: 140, kcalPer: 4, color: '#F97316' },
  { label: 'Carbs',   grams: 220, kcalPer: 4, color: '#FB923C' },
  { label: 'Fat',     grams: 55,  kcalPer: 9, color: '#FDBA74' },
];
const TOTAL_KCAL = RAW_MACROS.reduce((s, m) => s + m.grams * m.kcalPer, 0);
const MACROS = RAW_MACROS.map(m => ({ ...m, pct: (m.grams * m.kcalPer) / TOTAL_KCAL }));

const GOAL_LABELS: Record<string, string> = {
  lose: 'Lose weight', muscle: 'Build muscle',
  energy: 'Boost energy', maintain: 'Maintain weight',
};
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary', light: 'Lightly active',
  moderate: 'Moderately active', very: 'Very active',
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
  const [displayCals, setDisplayCals] = useState(0);

  // ── Animated values ───────────────────────────────────────────────────────
  const eyebrowFade = useRef(new Animated.Value(0)).current;
  const eyebrowY    = useRef(new Animated.Value(12)).current;
  const numFade     = useRef(new Animated.Value(0)).current;
  const numY        = useRef(new Animated.Value(20)).current;
  const ruleFade    = useRef(new Animated.Value(0)).current;
  const ruleScaleX  = useRef(new Animated.Value(0)).current;
  const bar0        = useRef(new Animated.Value(0)).current;
  const bar1        = useRef(new Animated.Value(0)).current;
  const bar2        = useRef(new Animated.Value(0)).current;
  const barFades    = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  const barAnims    = [bar0, bar1, bar2];
  const bottomFade  = useRef(new Animated.Value(0)).current;
  const bottomY     = useRef(new Animated.Value(16)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;

  // ── Sequence ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const CURVE = Easing.out(Easing.cubic);

    Animated.parallel([
      Animated.timing(eyebrowFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(eyebrowY,   { toValue: 0, duration: 440, easing: CURVE, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(numFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(numY,    { toValue: 0, duration: 440, easing: CURVE, useNativeDriver: true }),
      ]).start();
      Animated.timing(glowAnim, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

      let current = 0;
      const step  = Math.ceil(TARGET_CALS / 60);
      const timer = setInterval(() => {
        current = Math.min(current + step, TARGET_CALS);
        setDisplayCals(current);
        if (current >= TARGET_CALS) {
          clearInterval(timer);

          Animated.parallel([
            Animated.timing(ruleFade,   { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(ruleScaleX, { toValue: 1, duration: 500, easing: CURVE, useNativeDriver: true }),
          ]).start();

          barFades.forEach((f, i) =>
            Animated.timing(f, { toValue: 1, duration: 360, delay: 200 + i * 110, useNativeDriver: true }).start()
          );
          barAnims.forEach((b, i) =>
            Animated.timing(b, { toValue: 1, duration: 700, delay: 400 + i * 110, easing: CURVE, useNativeDriver: false }).start()
          );

          Animated.parallel([
            Animated.timing(bottomFade, { toValue: 1, duration: 400, delay: 700, useNativeDriver: true }),
            Animated.timing(bottomY,    { toValue: 0, duration: 360, delay: 700, easing: CURVE, useNativeDriver: true }),
          ]).start();
        }
      }, 16);
      return () => clearInterval(timer);
    }, 250);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const name     = params.name || 'You';
  const goal     = GOAL_LABELS[params.goal]         || 'Your goal';
  const activity = ACTIVITY_LABELS[params.activity] || 'Active';

  return (
    <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}>

      {/* Ambient glow */}
      <Animated.View pointerEvents="none" style={[s.glow, { opacity: glowAnim }]} />

      {/* ── Eyebrow ── */}
      <Animated.View style={[s.eyebrowRow, { opacity: eyebrowFade, transform: [{ translateY: eyebrowY }] }]}>
        <View style={s.eyebrowDot} />
        <Text style={s.eyebrowText}>YOUR PLAN IS READY</Text>
      </Animated.View>

      {/* ── Calorie hero ── */}
      <Animated.View style={[s.heroBlock, { opacity: numFade, transform: [{ translateY: numY }] }]}>
        <Text style={s.calNum} numberOfLines={1}>
          {displayCals.toLocaleString()}
        </Text>
        <Text style={s.calLabel}>calories per day</Text>
      </Animated.View>

      {/* Divider */}
      <Animated.View
        style={[s.rule, { opacity: ruleFade, transform: [{ scaleX: ruleScaleX }] }]}
      />

      {/* ── Macros ── */}
      <View style={s.macroBlock}>
        {MACROS.map((m, i) => (
          <Animated.View key={m.label} style={[s.macroRow, { opacity: barFades[i] }]}>
            <Text style={s.macroLabel}>{m.label}</Text>
            <View style={s.barTrack}>
              <Animated.View
                style={[s.barFill, {
                  backgroundColor: m.color,
                  width: barAnims[i].interpolate({
                    inputRange:  [0, 1],
                    outputRange: ['0%', `${Math.round(m.pct * 100)}%`],
                  }),
                }]}
              />
            </View>
            <Text style={[s.macroGrams, { color: m.color }]}>{m.grams}g</Text>
          </Animated.View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      {/* ── Bottom ── */}
      <Animated.View style={[s.bottom, { opacity: bottomFade, transform: [{ translateY: bottomY }] }]}>

        {/* Profile summary — dot-separated inline row */}
        <View style={s.summaryRow}>
          {[name, goal, activity].map((label, i) => (
            <View key={label} style={s.summaryItem}>
              {i > 0 && <View style={s.summaryDot} />}
              <Text style={s.summaryText} numberOfLines={1}>{label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={s.cta}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/auth/sign-up', params })}
        >
          <Text style={s.ctaText}>Create my account</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {/* Log in */}
        <TouchableOpacity style={s.loginRow} activeOpacity={0.6} onPress={() => router.push('/auth/login')}>
          <Text style={s.loginText}>
            Already have an account?{'  '}
            <Text style={s.loginAccent}>Log in</Text>
          </Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 28,
  },

  /* Glow */
  glow: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(249,115,22,0.08)',
  },

  /* Eyebrow */
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 40,
  },
  eyebrowDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F97316',
  },
  eyebrowText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 10,
    letterSpacing: 2.4,
    color: '#F97316',
  },

  /* Calorie hero */
  heroBlock: {
    marginBottom: 28,
    gap: 6,
  },
  calNum: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 100,
    color: '#111111',
    letterSpacing: -5,
    lineHeight: 100,
  },
  calLabel: {
    fontFamily: 'Syne_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: '#aaa',
    textTransform: 'uppercase',
  },

  /* Rule */
  rule: {
    height: 1,
    backgroundColor: '#F97316',
    borderRadius: 1,
    marginBottom: 32,
    transformOrigin: 'left center',
  },

  /* Macros */
  macroBlock: {
    gap: 18,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  macroLabel: {
    fontFamily: 'Syne_700Bold',
    fontSize: 11,
    color: '#888',
    width: 52,
    letterSpacing: 0.2,
  },
  barTrack: {
    flex: 1,
    height: 3,
    backgroundColor: '#E8E3DC',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
  macroGrams: {
    fontFamily: 'Syne_700Bold',
    fontSize: 12,
    width: 36,
    textAlign: 'right',
    letterSpacing: -0.2,
  },

  /* Bottom */
  bottom: {
    gap: 16,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 0,
    marginBottom: 4,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#ccc',
    marginHorizontal: 10,
  },
  summaryText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 12,
    color: '#888',
    letterSpacing: 0.1,
  },

  /* CTA */
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 10,
    paddingVertical: 18,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaText: {
    fontFamily: 'Syne_700Bold',
    color: '#FFF',
    fontSize: 16,
    letterSpacing: 0.2,
  },

  /* Log in */
  loginRow: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  loginText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '400',
  },
  loginAccent: {
    color: '#F97316',
    fontFamily: 'Syne_700Bold',
  },
});
