import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';

const LEVELS = [
  { id: 'sedentary', icon: 'desktop-outline' as const, label: 'Not very active', sub: 'Mostly sitting, with little exercise' },
  { id: 'light', icon: 'walk-outline' as const, label: 'Lightly active', sub: 'Light exercise 1–3 days a week' },
  { id: 'moderate', icon: 'bicycle-outline' as const, label: 'Moderately active', sub: 'Exercise 3–5 days a week' },
  { id: 'very', icon: 'barbell-outline' as const, label: 'Very active', sub: 'Hard exercise or a physical job most days' },
];

export default function ActivityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string; height: string; weight: string; goal: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const bg = '#FAFAF8';

  const fade  = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;
  const rowFades = LEVELS.map(() => useRef(new Animated.Value(0)).current); // eslint-disable-line react-hooks/rules-of-hooks
  const rowYs    = LEVELS.map(() => useRef(new Animated.Value(20)).current); // eslint-disable-line react-hooks/rules-of-hooks

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    rowFades.forEach((f, i) => {
      Animated.parallel([
        Animated.timing(f,        { toValue: 1, duration: 380, delay: 160 + i * 80, useNativeDriver: true }),
        Animated.timing(rowYs[i], { toValue: 0, duration: 340, delay: 160 + i * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = selected !== null;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>

      <View style={{ flex: 1 }}>
      <Animated.View style={[{ opacity: fade, transform: [{ translateY: slideY }] }]}>
        <OnboardingQuestion before="How " emphasis="active" after=" is your typical week?" />
        <Text style={s.subheadline}>Choose the option that best describes most weeks.</Text>
        <WhyWeAsk
          text="We use this to estimate how many calories you burn daily."
          style={s.whyWeAsk}
        />
      </Animated.View>

      <View style={s.list}>
        {LEVELS.map((lvl, i) => {
          const active = selected === lvl.id;
          return (
            <Animated.View
              key={lvl.id}
              style={{ opacity: rowFades[i], transform: [{ translateY: rowYs[i] }] }}
            >
              <TouchableOpacity
                style={[s.row, active && s.rowActive]}
                onPress={() => setSelected(lvl.id)}
                activeOpacity={0.75}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${lvl.label}. ${lvl.sub}`}
              >
                <View style={s.iconSlot}>
                  <Ionicons
                    name={lvl.icon}
                    size={27}
                    color={active ? '#E85D2A' : '#171717'}
                  />
                </View>

                <View style={s.rowText}>
                  <Text style={[s.rowLabel, active && s.rowLabelActive]}>{lvl.label}</Text>
                  <Text style={[s.rowSub, active && s.rowSubActive]}>{lvl.sub}</Text>
                </View>

                <View style={[s.radio, active && s.radioActive]}>
                  {active && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      </View>

      <PrimaryCTA
        label="Continue"
        disabled={!canContinue}
        onPress={() => router.push({
          pathname: '/onboarding/units',
          params: { ...params, activity: selected! },
        })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, paddingHorizontal: 28 },
  subheadline: { fontSize: 17, fontWeight: '400', lineHeight: 24, marginBottom: 6, color: '#888888' },
  whyWeAsk:    { marginBottom: 22 },

  list: { gap: 10 },
  row: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: '#F2F1F6',
  },
  rowActive: { backgroundColor: '#FCE5DD' },
  iconSlot: { width: 48, alignItems: 'flex-start', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3, paddingRight: 10 },
  rowLabel: { fontFamily: 'Archivo_600SemiBold', fontSize: 17, lineHeight: 21, color: '#111111' },
  rowLabelActive: { color: '#E85D2A' },
  rowSub: { fontFamily: 'Archivo_400Regular', fontSize: 13.5, lineHeight: 18, color: '#98969E' },
  rowSubActive: { color: '#D06A43' },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E1E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: '#FFFFFF' },
  radioDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#F0642D' },
});
