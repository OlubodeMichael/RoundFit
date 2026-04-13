import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { ProgressBar } from '@/components/onboarding/progress-bar';

export default function UnitsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string; height: string; weight: string; goal: string; activity: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [unit, setUnit] = useState<'km' | 'mi' | null>(null);

  const bg   = isDark ? '#0A0A0A' : '#FAFAF8';
  const hi   = isDark ? '#F5F5F5' : '#111111';
  const mid  = isDark ? '#777'    : '#888';
  const lo   = isDark ? '#2A2A2A' : '#E8E3DC';
  const surf = isDark ? '#141414' : '#FFFFFF';

  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;
  const card1F = useRef(new Animated.Value(0)).current;
  const card2F = useRef(new Animated.Value(0)).current;
  const card1Y = useRef(new Animated.Value(32)).current;
  const card2Y = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(card1F, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
      Animated.timing(card1Y, { toValue: 0, duration: 360, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(card2F, { toValue: 1, duration: 400, delay: 320, useNativeDriver: true }),
      Animated.timing(card2Y, { toValue: 0, duration: 360, delay: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = unit !== null;

  const OPTIONS: { key: 'km' | 'mi'; unit: string; system: string; detail: string }[] = [
    { key: 'km', unit: 'km',  system: 'Metric',   detail: 'Kilometres · km/h' },
    { key: 'mi', unit: 'mi',  system: 'Imperial', detail: 'Miles · mph' },
  ];

  const cardAnims = [{ fade: card1F, y: card1Y }, { fade: card2F, y: card2Y }];

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar step={8} total={9} onBack={() => router.back()} isDark={isDark} />
      </View>

      <Animated.View style={[{ opacity: fade, transform: [{ translateY: slideY }] }]}>
        <Text style={[s.headline, { color: hi }]}>Your unit.</Text>
        <Text style={[s.sub, { color: mid }]}>Used for distance tracking and goals.</Text>
      </Animated.View>

      <View style={s.cards}>
        {OPTIONS.map((opt, i) => {
          const active = unit === opt.key;
          return (
            <Animated.View
              key={opt.key}
              style={[s.cardWrap, { opacity: cardAnims[i].fade, transform: [{ translateY: cardAnims[i].y }] }]}
            >
              <TouchableOpacity
                style={[s.card, {
                  backgroundColor: active ? 'rgba(249,115,22,0.08)' : surf,
                  borderColor: active ? '#F97316' : lo,
                  borderWidth: active ? 1.5 : 1,
                }]}
                onPress={() => setUnit(opt.key)}
                activeOpacity={0.8}
              >
                {active && <View style={s.cardAccentTop} />}
                <Text style={[s.unitGiant, { color: active ? '#F97316' : hi }]}>{opt.unit}</Text>
                <Text style={[s.systemLabel, { color: active ? '#F97316' : hi }]}>{opt.system}</Text>
                <Text style={[s.detailText, { color: mid }]}>{opt.detail}</Text>
              </TouchableOpacity>
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
          pathname: '/onboarding/health-connect',
          params: { ...params, unit: unit! },
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
  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48, marginBottom: 6 },
  sub:      { fontSize: 15, fontWeight: '400', lineHeight: 22, marginBottom: 40 },

  cards:    { flexDirection: 'row', gap: 14 },
  cardWrap: { flex: 1 },
  card:     {
    borderRadius: 20, paddingVertical: 36, paddingHorizontal: 16,
    alignItems: 'center', gap: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  cardAccentTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 3, backgroundColor: '#F97316',
  },
  unitGiant:   { fontSize: 52, fontWeight: '900', letterSpacing: -2, lineHeight: 58 },
  systemLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  detailText:  { fontSize: 12, fontWeight: '400' },

  cta:    {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
