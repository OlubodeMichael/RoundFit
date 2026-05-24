import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ProgressBar } from '@/components/onboarding/progress-bar';

const LEVELS = [
  { id: 'sedentary', num: '01', label: 'Sedentary',         multiplier: '× 1.20',  sub: 'Desk job, little exercise',      kcal: '+0 kcal'   },
  { id: 'light',     num: '02', label: 'Lightly active',    multiplier: '× 1.375', sub: '1–3 light workouts / week',      kcal: '+260 kcal' },
  { id: 'moderate',  num: '03', label: 'Moderately active', multiplier: '× 1.55',  sub: '3–5 workouts / week',            kcal: '+520 kcal' },
  { id: 'very',      num: '04', label: 'Very active',       multiplier: '× 1.725', sub: '6–7 workouts or physical job',   kcal: '+820 kcal' },
];

export default function ActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string; height: string; weight: string; goal: string }>();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  const bg = '#FAFAF8';
  const hi = '#111111';
  const lo = '#E8E3DC';

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
        <ProgressBar step={6} total={9} backHref={{ pathname: '/onboarding/goal', params }} isDark={false} />
      </View>

      <View style={{ flex: 1 }}>
      <Animated.View style={[{ opacity: fade, transform: [{ translateY: slideY }] }]}>
        <Text style={[s.headline, { color: hi }]}>Your{'\n'}activity.</Text>
        <Text style={s.subheadline}>Outside of structured workouts, on a typical week.</Text>
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
                style={s.row}
                onPress={() => setSelected(lvl.id)}
                activeOpacity={0.75}
              >
                {/* Number */}
                <Text style={[s.rowNum, { color: active ? '#F97316' : '#DDDDDD' }]}>
                  {lvl.num}
                </Text>

                {/* Label + sub */}
                <View style={s.rowText}>
                  <View style={s.rowLabelRow}>
                    <Text style={[s.rowLabel, { color: active ? '#F97316' : hi }]}>{lvl.label}</Text>
                    <Text style={[s.rowMultiplier, { color: active ? '#F97316' : '#BBBBBB' }]}> {lvl.multiplier}</Text>
                  </View>
                  <Text style={s.rowSub}>{lvl.sub}</Text>
                </View>

                {/* Kcal + circle */}
                <View style={s.rowRight}>
                  <Text style={[s.rowKcal, { color: active ? '#F97316' : '#BBBBBB' }]}>{lvl.kcal}</Text>
                  <View style={[s.checkCircle, {
                    borderColor: active ? '#F97316' : lo,
                    backgroundColor: active ? '#F97316' : 'transparent',
                  }]}>
                    {active && <Ionicons name="checkmark" size={12} color="#FFF" />}
                  </View>
                </View>
              </TouchableOpacity>
              {!isLast && <View style={s.divider} />}
            </Animated.View>
          );
        })}
      </View>

      </View>

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
  root:        { flex: 1, paddingHorizontal: 28 },
  progress:    { marginBottom: 8 },
  headline:    { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48, marginBottom: 8 },
  subheadline: { fontSize: 17, fontWeight: '400', lineHeight: 24, marginBottom: 28, color: '#888888' },

  list: { gap: 0 },
  row:  {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 20, gap: 12,
  },

  rowNum: {
    fontSize: 28, fontWeight: '900', letterSpacing: -1,
    minWidth: 36, fontVariant: ['tabular-nums'],
  },

  rowText:     { flex: 1, gap: 4 },
  rowLabelRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  rowLabel:    { fontSize: 19, fontWeight: '700' },
  rowMultiplier: { fontSize: 15, fontWeight: '500' },
  rowSub:      { fontSize: 16, lineHeight: 23, color: '#888888' },

  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowKcal:  { fontSize: 15, fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },

  checkCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { height: 1, backgroundColor: '#E8E3DC' },

  cta: {
    backgroundColor: '#111111', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
