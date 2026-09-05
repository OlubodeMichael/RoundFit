import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';

const BG = '#FAFAF8';
const INK = '#111111';
const ORANGE = '#F97316';

const SEX_OPTIONS = [
  { value: 'male' as const, label: 'Male', icon: 'male' as const },
  { value: 'female' as const, label: 'Female', icon: 'female' as const },
];

export default function AgeSexScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useOnboardingDraft();
  const { age, sex } = draft;

  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeAge = (delta: number) => {
    updateDraft({ age: Math.min(90, Math.max(13, age + delta)) });
  };

  return (
    <View style={s.root}>
      <View style={s.content}>
        <Animated.View style={[s.body, { opacity: fade, transform: [{ translateY: slideY }] }]}>
          <View>
            <OnboardingQuestion before="What’s your " emphasis="age" after=" and gender?" />
            <WhyWeAsk
              text="A few details help us calculate a plan that fits you."
              style={s.whyWeAsk}
            />
          </View>

          <View style={s.ageSection}>
            <View style={s.ageHeader}>
              <Text style={s.sectionTitle}>Your age</Text>
              <Text style={s.ageRange}>13–90 years</Text>
            </View>

            <View style={s.ageControl}>
              <Pressable
                style={({ pressed }) => [
                  s.ageButton,
                  pressed && s.ageButtonPressed,
                  age === 13 && s.ageButtonDisabled,
                ]}
                onPress={() => changeAge(-1)}
                disabled={age === 13}
                accessibilityRole="button"
                accessibilityLabel="Decrease age"
                accessibilityState={{ disabled: age === 13 }}
              >
                <Ionicons name="remove" size={25} color={INK} />
              </Pressable>

              <View
                style={s.ageReadout}
                pointerEvents="none"
                accessible
                accessibilityLabel={`${age} years old`}
              >
                <Text style={s.ageValue}>{age}</Text>
                <Text style={s.ageUnit}>years old</Text>
                <View style={s.ageAccent} />
              </View>

              <Pressable
                style={({ pressed }) => [
                  s.ageButton,
                  pressed && s.ageButtonPressed,
                  age === 90 && s.ageButtonDisabled,
                ]}
                onPress={() => changeAge(1)}
                disabled={age === 90}
                accessibilityRole="button"
                accessibilityLabel="Increase age"
                accessibilityState={{ disabled: age === 90 }}
              >
                <Ionicons name="add" size={25} color={INK} />
              </Pressable>
            </View>
          </View>

          <View style={s.sexSection}>
            <Text style={s.sectionTitle}>Gender</Text>
            <Text style={s.sectionHelp}>Select the option that fits you.</Text>

            <View style={s.sexList} accessibilityRole="radiogroup">
              {SEX_OPTIONS.map((option) => {
                const active = sex === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      s.sexOption,
                      active && s.sexOptionActive,
                      pressed && s.pressed,
                    ]}
                    onPress={() => updateDraft({ sex: option.value })}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={`${option.label}, gender`}
                    accessibilityHint="Used only for your baseline calorie calculation"
                  >
                    <Ionicons
                      name={option.icon}
                      size={24}
                      color={active ? '#FFFFFF' : ORANGE}
                    />
                    <Text style={[s.sexLabel, active && s.sexLabelActive]}>{option.label}</Text>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={21}
                        color="#FFFFFF"
                        style={s.sexCheck}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>

      <PrimaryCTA
        label="Continue"
        disabled={sex === null}
        onPress={() => router.push({
          pathname: '/onboarding/height-weight',
          params: { age: String(age), sex },
        })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 28, backgroundColor: BG },
  content: { flex: 1 },
  body: { gap: 32 },
  whyWeAsk: { marginTop: 10 },

  ageSection: { gap: 10 },
  ageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 17,
    letterSpacing: -0.25,
    color: INK,
  },
  ageRange: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 13,
    color: '#716C65',
  },
  ageControl: {
    minHeight: 152,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  ageButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0ECE7',
  },
  ageButtonPressed: {
    backgroundColor: '#FFDAC0',
  },
  ageButtonDisabled: { opacity: 0.35 },
  ageReadout: {
    minWidth: 142,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageValue: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 76,
    lineHeight: 78,
    letterSpacing: -4,
    color: INK,
    fontVariant: ['tabular-nums'],
  },
  ageUnit: {
    marginTop: 0,
    fontFamily: 'Archivo_500Medium',
    fontSize: 14,
    letterSpacing: 0,
    color: '#716C65',
  },
  ageAccent: {
    width: 32,
    height: 3,
    marginTop: 12,
    borderRadius: 2,
    backgroundColor: ORANGE,
  },

  sexSection: { gap: 6, marginTop: 44 },
  sectionHelp: {
    marginBottom: 14,
    fontFamily: 'Archivo_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#716C65',
  },
  sexList: {
    flexDirection: 'row',
    gap: 12,
  },
  sexOption: {
    flex: 1,
    minHeight: 82,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    backgroundColor: '#F0ECE7',
  },
  sexOptionActive: {
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  pressed: { opacity: 0.72 },
  sexLabel: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 16,
    letterSpacing: -0.3,
    color: '#625D57',
  },
  sexLabelActive: { color: '#FFFFFF' },
  sexCheck: { marginLeft: 'auto' },
});
