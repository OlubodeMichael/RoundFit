import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ProgressBar } from '@/components/onboarding/progress-bar';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const OPTIONS: { key: 'metric' | 'imperial'; icon: IoniconsName; label: string; desc: string }[] = [
  {
    key:   'metric',
    icon:  'planet-outline',
    label: 'Metric',
    desc:  'Weight in kg · Height in cm · km/h',
  },
  {
    key:   'imperial',
    icon:  'flag-outline',
    label: 'Imperial',
    desc:  'Weight in lbs · Height in ft & in · miles/h',
  },
];

export default function UnitsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string; height: string; weight: string; goal: string; activity: string }>();
  const insets = useSafeAreaInsets();
  const [unit, setUnit] = useState<'metric' | 'imperial' | null>(null);

  const bg   = '#FAFAF8';
  const hi   = '#111111';
  const mid  = '#888';
  const lo   = '#E8E3DC';
  const surf = '#FFFFFF';

  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;
  const card1F = useRef(new Animated.Value(0)).current;
  const card2F = useRef(new Animated.Value(0)).current;
  const card1Y = useRef(new Animated.Value(28)).current;
  const card2Y = useRef(new Animated.Value(28)).current;

  const cardAnims = [
    { fade: card1F, y: card1Y },
    { fade: card2F, y: card2Y },
  ];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    [[card1F, card1Y, 150], [card2F, card2Y, 230]].forEach(([f, y, delay]) => {
      Animated.parallel([
        Animated.timing(f as Animated.Value, { toValue: 1, duration: 400, delay: delay as number, useNativeDriver: true }),
        Animated.timing(y as Animated.Value, { toValue: 0, duration: 360, delay: delay as number, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = unit !== null;

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar step={7} total={9} onBack={() => router.back()} isDark={false} />
      </View>

      <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
        <Text style={[s.headline, { color: hi }]}>Your unit.</Text>
        <Text style={[s.sub, { color: mid }]}>Used for weight, height and body stats.</Text>
      </Animated.View>

      <View style={s.grid}>
        {OPTIONS.map((opt, i) => {
          const active = unit === opt.key;
          return (
            <Animated.View
              key={opt.key}
              style={[s.cardWrapper, { opacity: cardAnims[i].fade, transform: [{ translateY: cardAnims[i].y }] }]}
            >
              <TouchableOpacity
                style={[s.card, {
                  backgroundColor: active ? 'rgba(249,115,22,0.08)' : surf,
                  borderColor:     active ? '#F97316' : lo,
                  borderLeftWidth: active ? 4 : 1,
                  borderWidth:     1,
                }]}
                onPress={() => setUnit(opt.key)}
                activeOpacity={0.8}
              >
                <View style={[s.iconWrap, { backgroundColor: active ? 'rgba(249,115,22,0.12)' : '#F2EFE9' }]}>
                  <Ionicons name={opt.icon} size={22} color={active ? '#F97316' : mid} />
                </View>
                <Text style={[s.cardLabel, { color: active ? '#F97316' : hi }]}>{opt.label}</Text>
                <Text style={[s.cardDesc, { color: mid }]}>{opt.desc}</Text>
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
          pathname: '/onboarding/name',
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
  sub:      { fontSize: 15, fontWeight: '400', lineHeight: 22, marginBottom: 32 },

  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cardWrapper: { width: '47%' },
  card: {
    borderRadius: 16,
    padding:      18,
    gap:          10,
    minHeight:    140,
    overflow:     'hidden',
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  cardDesc:  { fontSize: 12, lineHeight: 17, fontWeight: '400' },

  cta: {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
