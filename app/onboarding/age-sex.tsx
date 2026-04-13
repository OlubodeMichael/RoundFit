import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { ProgressBar } from '@/components/onboarding/progress-bar';

export default function AgeSexScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [age, setAge] = useState(25);
  const [sex, setSex] = useState<'male' | 'female' | null>(null);

  const bg   = isDark ? '#0A0A0A' : '#FAFAF8';
  const hi   = isDark ? '#F5F5F5' : '#111111';
  const mid  = isDark ? '#777'    : '#888';
  const lo   = isDark ? '#2A2A2A' : '#E8E3DC';
  const surf = isDark ? '#141414' : '#FFFFFF';

  const fade  = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeAge  = (d: number) => setAge(a => Math.min(90, Math.max(13, a + d)));
  const canContinue = sex !== null;

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar step={4} total={9} onBack={() => router.back()} isDark={isDark} />
      </View>

      <Animated.View style={[s.body, { opacity: fade, transform: [{ translateY: slideY }] }]}>
        <Text style={[s.headline, { color: hi }]}>About you.</Text>

        {/* ── Age ── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: mid }]}>Age</Text>
          <View style={s.ageStepper}>
            <TouchableOpacity
              style={[s.stepBtn, { borderColor: lo }]}
              onPress={() => changeAge(-1)}
              activeOpacity={0.7}
            >
              <Text style={[s.stepBtnText, { color: hi }]}>−</Text>
            </TouchableOpacity>

            <View style={s.ageDisplay}>
              <Text style={[s.ageNum, { color: hi }]}>{age}</Text>
              <Text style={[s.ageUnit, { color: mid }]}>years old</Text>
            </View>

            <TouchableOpacity
              style={[s.stepBtn, { borderColor: lo }]}
              onPress={() => changeAge(1)}
              activeOpacity={0.7}
            >
              <Text style={[s.stepBtnText, { color: hi }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sex ── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: mid }]}>Sex</Text>
          <View style={s.sexRow}>
            {(['male', 'female'] as const).map(opt => {
              const active = sex === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[s.sexPill, {
                    backgroundColor: active ? 'rgba(249,115,22,0.10)' : surf,
                    borderColor: active ? '#F97316' : lo,
                    borderWidth: active ? 1.5 : 1,
                  }]}
                  onPress={() => setSex(opt)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.sexLabel, { color: active ? '#F97316' : hi }]}>
                    {opt === 'male' ? 'Male' : 'Female'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={[s.cta, { opacity: canContinue ? 1 : 0.35 }]}
        activeOpacity={0.85}
        disabled={!canContinue}
        onPress={() => router.push({
          pathname: '/onboarding/height-weight',
          params: { name: params.name, age: String(age), sex },
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
  body:     { gap: 44 },
  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48 },

  section:      {},
  sectionLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1.5, marginBottom: 20,
  },

  ageStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 },
  stepBtn:    { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stepBtnText: { fontSize: 28, fontWeight: '200', lineHeight: 34 },
  ageDisplay: { alignItems: 'center', minWidth: 120 },
  ageNum:     { fontSize: 80, fontWeight: '900', letterSpacing: -3, lineHeight: 84 },
  ageUnit:    { fontSize: 13, fontWeight: '500', marginTop: -6 },

  sexRow:   { flexDirection: 'row', gap: 12 },
  sexPill:  { flex: 1, paddingVertical: 22, borderRadius: 14, alignItems: 'center' },
  sexLabel: { fontSize: 17, fontWeight: '700' },

  cta:    {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
