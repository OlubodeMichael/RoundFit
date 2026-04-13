import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { ProgressBar } from '@/components/onboarding/progress-bar';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const GOALS: { id: string; icon: IoniconsName; label: string; desc: string }[] = [
  { id: 'lose',     icon: 'flame-outline',   label: 'Lose weight',    desc: 'Burn fat, feel lighter' },
  { id: 'muscle',   icon: 'barbell-outline', label: 'Build muscle',   desc: 'Get stronger, tone up' },
  { id: 'energy',   icon: 'flash-outline',   label: 'Boost energy',   desc: 'Feel more alive daily' },
  { id: 'maintain', icon: 'scale-outline',   label: 'Maintain',       desc: 'Stay right where I am' },
];

export default function GoalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string; height: string; weight: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const bg   = isDark ? '#0A0A0A' : '#FAFAF8';
  const hi   = isDark ? '#F5F5F5' : '#111111';
  const mid  = isDark ? '#777'    : '#888';
  const lo   = isDark ? '#2A2A2A' : '#E8E3DC';
  const surf = isDark ? '#141414' : '#FFFFFF';

  const fade  = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;
  const cardFades = [
    useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current,
  ];
  const cardYs = [
    useRef(new Animated.Value(28)).current, useRef(new Animated.Value(28)).current,
    useRef(new Animated.Value(28)).current, useRef(new Animated.Value(28)).current,
  ];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    cardFades.forEach((f, i) => {
      Animated.parallel([
        Animated.timing(f,          { toValue: 1, duration: 400, delay: 150 + i * 80, useNativeDriver: true }),
        Animated.timing(cardYs[i],  { toValue: 0, duration: 360, delay: 150 + i * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = selected !== null;

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar step={6} total={9} onBack={() => router.back()} isDark={isDark} />
      </View>

      <Animated.View style={[{ opacity: fade, transform: [{ translateY: slideY }] }]}>
        <Text style={[s.headline, { color: hi }]}>Your main{'\n'}goal.</Text>
      </Animated.View>

      <View style={s.grid}>
        {GOALS.map((g, i) => {
          const active = selected === g.id;
          return (
            <Animated.View
              key={g.id}
              style={[{ opacity: cardFades[i], transform: [{ translateY: cardYs[i] }] }, s.cardWrapper]}
            >
              <TouchableOpacity
                style={[s.card, {
                  backgroundColor: active ? 'rgba(249,115,22,0.08)' : surf,
                  borderColor: active ? '#F97316' : lo,
                  borderLeftWidth: active ? 4 : 1,
                  borderWidth: 1,
                }]}
                onPress={() => setSelected(g.id)}
                activeOpacity={0.8}
              >
                <View style={[s.iconWrap, { backgroundColor: active ? 'rgba(249,115,22,0.12)' : (isDark ? '#1C1C1C' : '#F2EFE9') }]}>
                  <Ionicons name={g.icon} size={22} color={active ? '#F97316' : mid} />
                </View>
                <Text style={[s.cardLabel, { color: active ? '#F97316' : hi }]}>{g.label}</Text>
                <Text style={[s.cardDesc, { color: mid }]}>{g.desc}</Text>
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
          pathname: '/onboarding/activity',
          params: { ...params, goal: selected! },
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
  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48, marginBottom: 32 },

  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cardWrapper: { width: '47%' },
  card:        {
    borderRadius: 16, padding: 18,
    gap: 10, minHeight: 140,
    overflow: 'hidden',
  },
  iconWrap:  {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  cardDesc:  { fontSize: 12, lineHeight: 17, fontWeight: '400' },

  cta:    {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
