import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { TileGrid, Tile } from '@/components/onboarding/tile-grid';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';

const PHASES: Tile[] = [
  { id: 'menstrual',  icon: 'water-outline', label: 'Menstrual',  desc: 'On your period right now' },
  { id: 'follicular', icon: 'leaf-outline',  label: 'Follicular', desc: 'After period, energy rising' },
  { id: 'ovulation',  icon: 'sunny-outline', label: 'Ovulation',  desc: 'Mid-cycle, peak energy' },
  { id: 'luteal',     icon: 'moon-outline',  label: 'Luteal',     desc: 'Pre-period, winding down' },
];

export default function CyclePhaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string; height: string; weight: string;
    goal: string; activity: string; cycleLength: string;
  }>();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);

  const bg  = '#FAFAF8';
  const hi  = '#111111';
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
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar step={8} total={12} onBack={() => router.back()} isDark={false} />
      </View>

      <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
        <Text style={[s.headline, { color: hi }]}>Your current{'\n'}phase.</Text>
        <Text style={[s.sub, { color: mid }]}>Where are you in your cycle today?</Text>
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
  sub:      { fontSize: 15, fontWeight: '400', lineHeight: 22, marginBottom: 32 },
});
