import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ProgressBar } from '@/components/onboarding/progress-bar';

const LEVELS = [
  { id: 'sedentary', num: '01', label: 'Sedentary',        sub: 'Desk job, little or no exercise' },
  { id: 'light',     num: '02', label: 'Lightly Active',   sub: '1–3 light workouts per week' },
  { id: 'moderate',  num: '03', label: 'Moderately Active', sub: '3–5 workouts per week' },
  { id: 'very',      num: '04', label: 'Very Active',      sub: '6–7 workouts or physical job' },
];

export default function ActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string; height: string; weight: string; goal: string }>();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  const bg   = '#FAFAF8';
  const hi   = '#111111';
  const mid  = '#888';
  const lo   = '#E8E3DC';

  const fade  = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;
  const rowFades = LEVELS.map(() => useRef(new Animated.Value(0)).current); // eslint-disable-line react-hooks/rules-of-hooks
  const rowYs    = LEVELS.map(() => useRef(new Animated.Value(20)).current); // eslint-disable-line react-hooks/rules-of-hooks

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    rowFades.forEach((f, i) => {
      Animated.parallel([
        Animated.timing(f,        { toValue: 1, duration: 380, delay: 160 + i * 80, useNativeDriver: true }),
        Animated.timing(rowYs[i], { toValue: 0, duration: 340, delay: 160 + i * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = selected !== null;

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar step={6} total={9} onBack={() => router.back()} isDark={false} />
      </View>

      <Animated.View style={[{ opacity: fade, transform: [{ translateY: slideY }] }]}>
        <Text style={[s.headline, { color: hi }]}>Your{'\n'}activity.</Text>
      </Animated.View>

      <View style={s.list}>
        {LEVELS.map((lvl, i) => {
          const active = selected === lvl.id;
          const isLast = i === LEVELS.length - 1;
          return (
            <Animated.View
              key={lvl.id}
              style={[{ opacity: rowFades[i], transform: [{ translateY: rowYs[i] }] }]}
            >
              <TouchableOpacity
                style={[s.row, {
                  borderLeftColor: active ? '#F97316' : 'transparent',
                  backgroundColor: active ? 'rgba(249,115,22,0.05)' : 'transparent',
                }]}
                onPress={() => setSelected(lvl.id)}
                activeOpacity={0.75}
              >
                <Text style={[s.rowNum, { color: active ? 'rgba(249,115,22,0.5)' : ('#DDD') }]}>
                  {lvl.num}
                </Text>
                <View style={s.rowText}>
                  <Text style={[s.rowLabel, { color: active ? '#F97316' : hi }]}>{lvl.label}</Text>
                  <Text style={[s.rowSub, { color: mid }]}>{lvl.sub}</Text>
                </View>
                <View style={[s.checkCircle, {
                  borderColor: active ? '#F97316' : lo,
                  backgroundColor: active ? '#F97316' : 'transparent',
                }]}>
                  {active && <Ionicons name="checkmark" size={13} color="#FFF" />}
                </View>
              </TouchableOpacity>
              {!isLast && <View style={[s.divider, { backgroundColor: lo }]} />}
            </Animated.View>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={[s.cta, { opacity: canContinue ? 1 : 0.35 }]}
        activeOpacity={0.85}
        disabled={!canContinue}
        onPress={() => router.push({
          pathname: params.sex === 'female' ? '/onboarding/cycle-length' : '/onboarding/units',
          params: { ...params, activity: selected! },
        })}
      >
        <Text style={s.ctaText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 28 },
  progress: { marginBottom: 8 },
  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48, marginBottom: 32 },

  list: { gap: 0 },
  row:  {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 20, paddingHorizontal: 4,
    borderLeftWidth: 3, gap: 16,
    paddingLeft: 16,
  },
  rowNum:   { fontSize: 22, fontWeight: '900', letterSpacing: -1, minWidth: 32, fontVariant: ['tabular-nums'] },
  rowText:  { flex: 1, gap: 3 },
  rowLabel: { fontSize: 16, fontWeight: '700' },
  rowSub:   { fontSize: 13, lineHeight: 18 },
  checkCircle: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 1, marginLeft: 52 },

  cta:    {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
