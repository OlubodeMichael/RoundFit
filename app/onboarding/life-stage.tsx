import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { TileGrid, Tile } from '@/components/onboarding/tile-grid';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';

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
        <ProgressBar step={9} total={12} onBack={() => router.back()} isDark={false} />
      </View>

      <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
        <Text style={[s.headline, { color: hi }]}>Your life{'\n'}stage.</Text>
        <Text style={[s.sub, { color: mid }]}>We tailor calories and macros to where you are.</Text>
      </Animated.View>

      <TileGrid tiles={STAGES} selected={selected} onSelect={setSelected} />

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
  sub:      { fontSize: 15, fontWeight: '400', lineHeight: 22, marginBottom: 32 },
});
