import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';

const TARGET_CALS = 1847;
const MACROS = [
  { label: 'Protein', value: '140g', color: '#F97316' },
  { label: 'Carbs',   value: '220g', color: '#FB923C' },
  { label: 'Fat',     value: '55g',  color: '#FDBA74' },
];
const GOAL_LABELS: Record<string, string> = {
  lose:     'Lose weight',
  muscle:   'Build muscle',
  energy:   'Boost energy',
  maintain: 'Maintain weight',
};
const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  light:     'Lightly Active',
  moderate:  'Moderately Active',
  very:      'Very Active',
};

export default function RevealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; goal: string; activity: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [displayCals, setDisplayCals] = useState(0);
  const [revealed, setRevealed]       = useState(false);

  const bg   = isDark ? '#0A0A0A' : '#FAFAF8';
  const hi   = isDark ? '#F5F5F5' : '#111111';
  const mid  = isDark ? '#777'    : '#888';
  const lo   = isDark ? '#2A2A2A' : '#E8E3DC';
  const surf = isDark ? '#141414' : '#FFFFFF';

  const eyebrowFade = useRef(new Animated.Value(0)).current;
  const eyebrowY    = useRef(new Animated.Value(16)).current;
  const numFade     = useRef(new Animated.Value(0)).current;
  const numScale    = useRef(new Animated.Value(0.85)).current;
  const lineFade    = useRef(new Animated.Value(0)).current;
  const macroFade   = useRef(new Animated.Value(0)).current;
  const bottomFade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Eyebrow slides in
    Animated.parallel([
      Animated.timing(eyebrowFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(eyebrowY,    { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Number pops in after 400ms then counts up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(numFade,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(numScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      ]).start();

      let current = 0;
      const step  = Math.ceil(TARGET_CALS / 55);
      const timer = setInterval(() => {
        current = Math.min(current + step, TARGET_CALS);
        setDisplayCals(current);
        if (current >= TARGET_CALS) {
          clearInterval(timer);
          setRevealed(true);
          Animated.sequence([
            Animated.timing(lineFade,   { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(macroFade,  { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.timing(bottomFade, { toValue: 1, duration: 400, useNativeDriver: true }),
          ]).start();
        }
      }, 16);
      return () => clearInterval(timer);
    }, 500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const name     = params.name     || 'You';
  const goal     = GOAL_LABELS[params.goal]         || 'Your goal';
  const activity = ACTIVITY_LABELS[params.activity] || 'Active';

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>

      {/* Eyebrow */}
      <Animated.View style={[s.eyebrow, { opacity: eyebrowFade, transform: [{ translateY: eyebrowY }] }]}>
        <Text style={[s.eyebrowText, { color: mid }]}>Your daily target</Text>
      </Animated.View>

      {/* Big number reveal */}
      <View style={s.centerBlock}>
        {/* Glow */}
        <View style={s.glowRing} />

        <Animated.View style={[s.calBlock, { opacity: numFade, transform: [{ scale: numScale }] }]}>
          <View style={s.calRow}>
            <Text style={[s.calNum, { color: hi }]}>{displayCals.toLocaleString()}</Text>
            <View style={s.calUnitBlock}>
              <Text style={s.calUnit}>cal</Text>
              <Text style={[s.calUnitSub, { color: mid }]}>/ day</Text>
            </View>
          </View>

          {/* Orange rule */}
          <Animated.View style={[s.rule, { opacity: lineFade }]} />

          {/* Macros */}
          <Animated.View style={[s.macroRow, { opacity: macroFade }]}>
            {MACROS.map(m => (
              <View key={m.label} style={[s.macroPill, { backgroundColor: `${m.color}15`, borderColor: `${m.color}35` }]}>
                <View style={[s.macroDot, { backgroundColor: m.color }]} />
                <Text style={[s.macroLabel, { color: hi }]}>{m.label}</Text>
                <Text style={[s.macroValue, { color: m.color }]}>{m.value}</Text>
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </View>

      <View style={{ flex: 1 }} />

      {/* Summary + CTA */}
      <Animated.View style={[s.bottomBlock, { opacity: bottomFade }]}>
        <Text style={[s.summaryEyebrow, { color: mid }]}>Your profile</Text>
        <View style={s.chips}>
          {[
            { icon: 'person-outline' as const,  label: name },
            { icon: 'flag-outline' as const,    label: goal },
            { icon: 'pulse-outline' as const,   label: activity },
          ].map(chip => (
            <View key={chip.label} style={[s.chip, { backgroundColor: surf, borderColor: lo }]}>
              <Ionicons name={chip.icon} size={13} color="#F97316" />
              <Text style={[s.chipText, { color: hi }]}>{chip.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={s.cta}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/auth/sign-up', params: { name: params.name, goal: params.goal } })}
        >
          <Text style={s.ctaText}>Create my account  →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, paddingHorizontal: 28 },

  eyebrow:     { alignItems: 'center', marginBottom: 0 },
  eyebrowText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 },

  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glowRing:    {
    position: 'absolute',
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(249,115,22,0.07)',
  },

  calBlock: { alignItems: 'center', gap: 20 },
  calRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  calNum:   { fontSize: 96, fontWeight: '900', letterSpacing: -4, lineHeight: 100 },
  calUnitBlock: { paddingTop: 16, gap: 2 },
  calUnit:  { fontSize: 20, fontWeight: '800', color: '#F97316', lineHeight: 24 },
  calUnitSub: { fontSize: 13, fontWeight: '500', lineHeight: 16 },

  rule:     { width: 64, height: 2, backgroundColor: '#F97316', borderRadius: 1 },

  macroRow:  { flexDirection: 'row', gap: 8 },
  macroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  macroDot:   { width: 6, height: 6, borderRadius: 3 },
  macroLabel: { fontSize: 11, fontWeight: '600' },
  macroValue: { fontSize: 12, fontWeight: '800' },

  bottomBlock:    { gap: 16 },
  summaryEyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  chips:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },

  cta:    {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
});
