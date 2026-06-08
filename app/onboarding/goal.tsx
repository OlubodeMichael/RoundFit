import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { usePostHog } from 'posthog-react-native';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const GOALS: { id: string; icon: IoniconsName; label: string; desc: string; meta: string }[] = [
  { id: 'lose',     icon: 'flame-outline',      label: 'Lose weight',  desc: 'Burn fat, feel lighter',   meta: '-500 kcal/day · 0.45 kg/wk' },
  { id: 'muscle',   icon: 'barbell-outline',    label: 'Build muscle', desc: 'Get stronger, tone up',    meta: '+300 kcal/day · 0.25 kg/wk' },
  { id: 'energy',   icon: 'flash-outline',      label: 'Boost energy', desc: 'Feel more alive daily',    meta: 'Maintenance · macro optimised' },
  { id: 'maintain', icon: 'swap-horizontal',    label: 'Maintain',     desc: 'Stay right where I am',    meta: 'TDEE balanced · no deficit' },
];

export default function GoalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string; height: string; weight: string }>();
  const insets = useSafeAreaInsets();
  const total  = params.sex === 'female' ? 12 : 9;
  const [selected, setSelected] = useState<string | null>(null);
  const posthog = usePostHog();

  const bg  = '#FAFAF8';
  const hi  = '#111111';
  const mid = '#888';

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
        <ProgressBar step={5} total={total} backHref={{ pathname: '/onboarding/height-weight', params }} isDark={false} />
      </View>

      <View style={{ flex: 1 }}>
      <Animated.View style={[{ opacity: fade, transform: [{ translateY: slideY }] }]}>
        <Text style={[s.headline, { color: hi }]}>Your main{'\n'}goal.</Text>
        <WhyWeAsk
          text="We use this to set your calorie target and macro split."
          style={s.whyWeAsk}
        />
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
                style={[s.card, active && s.cardActive]}
                onPress={() => setSelected(g.id)}
                activeOpacity={0.82}
              >
                {/* Checkmark badge */}
                {active && (
                  <View style={s.checkBadge}>
                    <Ionicons name="checkmark" size={11} color="#FFF" />
                  </View>
                )}

                {/* Icon */}
                <View style={[s.iconWrap, active ? s.iconWrapActive : s.iconWrapInactive]}>
                  <Ionicons name={g.icon} size={22} color="#F97316" />
                </View>

                {/* Label + desc */}
                <Text style={[s.cardLabel, active && s.cardLabelActive]}>{g.label}</Text>
                <Text style={[s.cardDesc,  active && s.cardDescActive]}>{g.desc}</Text>

                {/* Meta stat */}
                <Text style={[s.cardMeta, active && s.cardMetaActive]}>{g.meta}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
      </View>

      <TouchableOpacity
        style={[s.cta, { opacity: canContinue ? 1 : 0.35 }]}
        activeOpacity={0.85}
        disabled={!canContinue}
        onPress={() => {
          posthog.capture('onboarding_goal_selected', { goal: selected });
          router.push({ pathname: '/onboarding/activity', params: { ...params, goal: selected! } });
        }}
      >
        <Text style={s.ctaText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 28 },
  progress: { marginBottom: 8 },
  headline: { fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 48, marginBottom: 8 },
  whyWeAsk: { marginBottom: 24 },

  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cardWrapper: { width: '47%' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    gap: 8,
    minHeight: 160,
    overflow: 'hidden',
  },
  cardActive: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },

  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  iconWrapActive:   { backgroundColor: '#2A2A2A' },
  iconWrapInactive: { backgroundColor: 'rgba(249,115,22,0.12)' },

  cardLabel: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, color: '#111111' },
  cardLabelActive: { color: '#FFFFFF' },

  cardDesc: { fontSize: 16, lineHeight: 23, fontWeight: '400', color: '#888888' },
  cardDescActive: { color: '#888888' },

  cardMeta: {
    fontSize: 15, fontWeight: '500', color: '#BBBBBB',
    lineHeight: 20, marginTop: 4,
  },
  cardMetaActive: { color: '#F97316' },

  cta: {
    backgroundColor: '#111111', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
