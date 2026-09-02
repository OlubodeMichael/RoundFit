import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Redirect, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TileGrid, Tile } from '@/components/onboarding/tile-grid';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { CYCLE_ENABLED } from '@/constants/features';

const PHASES: Tile[] = [
  { id: 'menstrual',  icon: 'water-outline', label: 'Menstrual',  desc: 'On your period right now' },
  { id: 'follicular', icon: 'leaf-outline',  label: 'Follicular', desc: 'After period, energy rising' },
  { id: 'ovulation',  icon: 'sunny-outline', label: 'Ovulation',  desc: 'Mid-cycle, peak energy' },
  { id: 'luteal',     icon: 'moon-outline',  label: 'Luteal',     desc: 'Pre-period, winding down' },
];

export default function CyclePhaseScreen() {
  // Held back from launch. The screen is intact but must not be reachable —
  // including by deep link or a typed-route jump, which the entry-point gate
  // alone does not cover. See CYCLE_FEATURE_REMOVAL_PLAN.md.
  if (!CYCLE_ENABLED) return <Redirect href="/onboarding" />;

  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string; height: string; weight: string;
    goal: string; activity: string; cycleLength: string;
  }>();
  const [selected, setSelected] = useState<string | null>(null);

  const bg  = '#FAFAF8';
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

      <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
        <OnboardingQuestion before="Where are you in your " emphasis="cycle" after=" today?" />
        <WhyWeAsk
          text="We use this to adjust your targets for where you are right now."
          style={s.whyWeAsk}
        />
      </Animated.View>

      <TileGrid tiles={PHASES} selected={selected} onSelect={setSelected} />

      <View style={{ flex: 1 }} />

      <PrimaryCTA
        label="Continue"
        disabled={selected === null}
        onPress={() => router.push({
          pathname: '/onboarding/life-stage',
          params: { ...params, cyclePhase: selected! },
        })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 28 },
  progress: { marginBottom: 8 },
  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48, marginBottom: 6 },
  sub:      { fontSize: 15, fontWeight: '400', lineHeight: 22, marginBottom: 6 },
  whyWeAsk: { marginBottom: 26 },
});
