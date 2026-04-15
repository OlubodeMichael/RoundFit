import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ProgressBar } from '@/components/onboarding/progress-bar';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const FEATURES: { icon: IoniconsName; label: string; sub: string }[] = [
  { icon: 'barbell-outline',     label: 'Train',    sub: 'Log workouts, sync activity, and hit every target.' },
  { icon: 'flame-outline',       label: 'Track',    sub: 'Log every meal in seconds and understand what powers you.' },
  { icon: 'moon-outline',        label: 'Recover',  sub: 'Monitor rest, reduce fatigue, and come back stronger.' },
];

export default function ValueHookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bg   = '#FAFAF8';
  const hi   = '#111111';
  const mid  = '#888';
  const lo   = '#E8E3DC';
  const surf = '#FFFFFF';

  const headerFade = useRef(new Animated.Value(0)).current;
  const headerY    = useRef(new Animated.Value(20)).current;
  const cardFades  = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const cardYs     = [useRef(new Animated.Value(24)).current, useRef(new Animated.Value(24)).current, useRef(new Animated.Value(24)).current];
  const btnFade    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerY,    { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    cardFades.forEach((f, i) => {
      Animated.parallel([
        Animated.timing(f,          { toValue: 1, duration: 420, delay: 200 + i * 130, useNativeDriver: true }),
        Animated.timing(cardYs[i],  { toValue: 0, duration: 380, delay: 200 + i * 130, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });

    Animated.timing(btnFade, { toValue: 1, duration: 400, delay: 700, useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar step={2} total={9} onBack={() => router.back()} isDark={false} />
      </View>

      <Animated.View style={[s.headBlock, { opacity: headerFade, transform: [{ translateY: headerY }] }]}>
        <Text style={[s.headLine, { color: hi }]}>Train.</Text>
        <Text style={[s.headLine, { color: hi }]}>Track.</Text>
        <Text style={[s.headLineAccent]}>Recover.</Text>
      </Animated.View>

      <View style={s.cards}>
        {FEATURES.map((f, i) => (
          <Animated.View
            key={f.label}
            style={[s.card, { backgroundColor: surf, borderColor: lo },
              { opacity: cardFades[i], transform: [{ translateY: cardYs[i] }] }]}
          >
            <View style={s.cardAccentBar} />
            <View style={[s.cardIcon, { backgroundColor: 'rgba(249,115,22,0.08)' }]}>
              <Ionicons name={f.icon} size={20} color="#F97316" />
            </View>
            <View style={s.cardText}>
              <Text style={[s.cardLabel, { color: hi }]}>{f.label}</Text>
              <Text style={[s.cardSub, { color: mid }]}>{f.sub}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <Animated.View style={[s.bottom, { opacity: btnFade }]}>
        <TouchableOpacity style={s.cta} activeOpacity={0.85} onPress={() => router.push('/onboarding/age-sex')}>
          <Text style={s.ctaText}>Let's build your plan  →</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 24 },
  progress: { marginBottom: 8 },

  headBlock:      { marginBottom: 32, gap: 0 },
  headLine:       { fontFamily: 'Syne_800ExtraBold', fontSize: 52, letterSpacing: -2.5, lineHeight: 56 },
  headLineAccent: { fontFamily: 'Syne_800ExtraBold', fontSize: 52, letterSpacing: -2.5, lineHeight: 56, color: '#F97316' },

  cards: { flex: 1, gap: 12, justifyContent: 'center' },
  card:  {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, paddingVertical: 18, paddingRight: 18,
    overflow: 'hidden',
  },
  cardAccentBar: { width: 3, height: '100%', backgroundColor: '#F97316', borderRadius: 2 },
  cardIcon:      {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  cardText:  { flex: 1, gap: 4 },
  cardLabel: { fontSize: 15, fontWeight: '700' },
  cardSub:   { fontSize: 13, lineHeight: 18 },

  bottom: { paddingTop: 16 },
  cta:    {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
