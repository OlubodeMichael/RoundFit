import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Redirect, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { NumericStepper } from '@/components/onboarding/numeric-stepper';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { CYCLE_ENABLED } from '@/constants/features';

const MIN_DAYS = 21;
const MAX_DAYS = 45;
const DEFAULT_DAYS = 28;

export default function CycleLengthScreen() {
  // Held back from launch. The screen is intact but must not be reachable —
  // including by deep link or a typed-route jump, which the entry-point gate
  // alone does not cover. See CYCLE_FEATURE_REMOVAL_PLAN.md.
  if (!CYCLE_ENABLED) return <Redirect href="/onboarding" />;

  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string; height: string; weight: string; goal: string; activity: string;
  }>();

  const [days, setDays] = useState(DEFAULT_DAYS);

  const bg  = '#FAFAF8';
  const mid = '#888';

  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (params.sex !== 'female') {
      router.replace({ pathname: '/onboarding/units', params });
      return;
    }
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.root, { backgroundColor: bg }]}>

      <Animated.View style={[s.body, { opacity: fade, transform: [{ translateY: slideY }] }]}>
        <OnboardingQuestion before="How long is your " emphasis="typical cycle" after="?" />
        <Text style={[s.sub, { color: mid }]}>
          Average number of days from the first day of your period to the start of the next.
        </Text>
        <WhyWeAsk
          text="We use this to tailor your calorie targets through your cycle."
          style={s.whyWeAsk}
        />

        <NumericStepper
          value={days}
          unit="days"
          min={MIN_DAYS}
          max={MAX_DAYS}
          onChange={setDays}
        />

        <Text style={[s.hint, { color: mid }]}>Not sure? 28 days is typical.</Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <PrimaryCTA
        label="Continue"
        onPress={() => router.push({
          pathname: '/onboarding/cycle-phase',
          params: { ...params, cycleLength: String(days) },
        })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 28 },
  progress: { marginBottom: 8 },
  body:     { gap: 28 },
  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48 },
  sub:      { fontSize: 15, fontWeight: '400', lineHeight: 22, marginTop: -14 },
  whyWeAsk: { marginTop: 4 },
  hint:     { fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
