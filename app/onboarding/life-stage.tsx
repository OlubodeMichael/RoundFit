import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Redirect, useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { TileGrid, Tile } from '@/components/onboarding/tile-grid';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { CYCLE_ENABLED } from '@/constants/features';
import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';

const STAGES: Tile[] = [
  { id: 'regular',       icon: 'sync-outline',     label: 'Regular cycle', desc: 'Predictable monthly cycle' },
  { id: 'postpartum',    icon: 'heart-outline',    label: 'Postpartum',    desc: 'Less than 12 months after birth' },
  { id: 'perimenopause', icon: 'time-outline',     label: 'Perimenopause', desc: 'Cycle changing, hormones shifting' },
  { id: 'menopause',     icon: 'sparkles-outline', label: 'Menopause',     desc: '12+ months without a period' },
];

export default function LifeStageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string; height: string; weight: string;
    goal: string; activity: string; cycleLength: string; cyclePhase: string;
  }>();
  const { draft, updateDraft } = useOnboardingDraft();
  const selected = draft.lifeStage;

  const bg  = '#FAFAF8';
  const mid = '#888';

  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!CYCLE_ENABLED) return;
    if (params.sex !== 'female') {
      router.replace({ pathname: '/onboarding/units', params });
      return;
    }
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!CYCLE_ENABLED) return <Redirect href="/onboarding" />;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>

      <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
        <OnboardingQuestion before="Which " emphasis="life stage" after=" fits you best?" />
        <Text style={[s.sub, { color: mid }]}>We tailor calories and macros to where you are.</Text>
        <WhyWeAsk
          text="We use this to account for hormonal shifts in your nutrition plan."
          style={s.whyWeAsk}
        />
      </Animated.View>

      <TileGrid tiles={STAGES} selected={selected} onSelect={(value) => updateDraft({ lifeStage: value })} />

      <View style={{ flex: 1 }} />

      <PrimaryCTA
        label="Continue"
        disabled={selected === null}
        onPress={() => router.push({
          pathname: '/onboarding/units',
          params: { ...params, lifeStage: selected! },
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
