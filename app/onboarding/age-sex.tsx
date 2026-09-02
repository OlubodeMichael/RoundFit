import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import Ionicons from '@expo/vector-icons/Ionicons';

const SEX_OPTIONS = [
  { value: 'male'   as const, label: 'Male',   icon: 'male',   bmr: 'BMR × 1.0'  },
  { value: 'female' as const, label: 'Female', icon: 'female', bmr: 'BMR × 0.95' },
];

export default function AgeSexScreen() {
  const router = useRouter();

  const [age, setAge] = useState(25);
  const [sex, setSex] = useState<'male' | 'female' | null>(null);

  const bg  = '#FAFAF8';
  const hi  = '#111111';
  const mid = '#888';
  const lo  = '#E8E3DC';

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
    <View style={[s.root, { backgroundColor: bg }]}>

      <View style={{ flex: 1 }}>
        <Animated.View style={[s.body, { opacity: fade, transform: [{ translateY: slideY }] }]}>
          <OnboardingQuestion before="What’s your " emphasis="age" after=" and biological sex?" />
          <WhyWeAsk
            text="We use this to calculate your personal calorie targets."
            style={s.whyWeAsk}
          />

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
            <Text style={[s.sectionLabel, { color: mid }]}>Biological Sex</Text>
            <View style={s.sexRow}>
              {SEX_OPTIONS.map(opt => {
                const active = sex === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.sexCard, active && s.sexCardActive]}
                    onPress={() => setSex(opt.value)}
                    activeOpacity={0.82}
                  >
                    {/* Checkmark badge */}
                    {active && (
                      <View style={s.checkBadge}>
                        <Ionicons name="checkmark" size={11} color="#FFF" />
                      </View>
                    )}

                    {/* Icon circle */}
                    <View style={[s.iconCircle, active ? s.iconCircleActive : s.iconCircleInactive]}>
                      <Ionicons
                        name={opt.icon as any}
                        size={22}
                        color={active ? '#FFFFFF' : '#F97316'}
                      />
                    </View>

                    {/* Label */}
                    <Text style={[s.sexCardLabel, active && s.sexCardLabelActive]}>
                      {opt.label}
                    </Text>

                    {/* BMR subtitle */}
                    <Text style={[s.sexCardSub, active && s.sexCardSubActive]}>
                      {opt.bmr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>

      <PrimaryCTA
        label="Continue"
        disabled={!canContinue}
        onPress={() => router.push({
          pathname: '/onboarding/height-weight',
          params: { age: String(age), sex },
        })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 28 },
  progress: { marginBottom: 8 },
  body:      { gap: 44 },
  headline:  { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48 },
  whyWeAsk:  { marginTop: -28, marginBottom: 8 },

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

  sexRow: { flexDirection: 'row', gap: 12 },

  sexCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  sexCardActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },

  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircleActive: {
    backgroundColor: '#2A2A2A',
  },
  iconCircleInactive: {
    backgroundColor: 'rgba(249,115,22,0.12)',
  },

  sexCardLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.2,
  },
  sexCardLabelActive: {
    color: '#FFFFFF',
  },

  sexCardSub: {
    fontSize: 15,
    fontWeight: '500',
    color: '#AAAAAA',
    letterSpacing: 0.1,
  },
  sexCardSubActive: {
    color: '#666666',
  },

  cta:    {
    backgroundColor: '#111111', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
