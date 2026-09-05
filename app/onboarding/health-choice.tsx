import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';

type HealthChoice = 'connect' | 'skip';

type OnboardingParams = {
  name: string;
  age: string;
  sex: string;
  height: string;
  weight: string;
  goal: string;
  activity: string;
  unit: string;
};

const OPTIONS = [
  {
    id: 'connect' as const,
    icon: 'heart' as const,
    title: 'Yes, connect',
    detail: 'Automatically sync activity, sleep and heart data.',
  },
  {
    id: 'skip' as const,
    icon: 'time-outline' as const,
    title: 'Not now',
    detail: 'You can connect later from your Profile.',
  },
];

export default function HealthChoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<OnboardingParams>();
  const { draft, updateDraft } = useOnboardingDraft();
  const selected: HealthChoice | null = draft.healthChoice;

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      router.replace({ pathname: '/onboarding/name', params });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS !== 'ios') return null;

  const continueOnboarding = () => {
    if (selected === 'connect') {
      router.push({ pathname: '/onboarding/health-connect', params });
      return;
    }

    if (selected === 'skip') {
      router.push({ pathname: '/onboarding/name', params });
    }
  };

  return (
    <View style={s.root}>
      <View style={s.content}>
        <OnboardingQuestion
          before="Would you like to connect "
          emphasis="Apple Health"
          after="?"
        />
        <WhyWeAsk
          text="This is optional. Connecting helps RoundFit update your plan automatically."
          style={s.description}
        />

        <View
          style={s.options}
          accessibilityRole="radiogroup"
          accessibilityLabel="Apple Health connection preference"
        >
          {OPTIONS.map((option) => {
            const active = selected === option.id;

            return (
              <TouchableOpacity
                key={option.id}
                activeOpacity={0.78}
                style={[s.option, active && s.optionActive]}
                onPress={() => updateDraft({ healthChoice: option.id })}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${option.title}. ${option.detail}`}
              >
                <View style={[s.icon, active && s.iconActive]}>
                  <Ionicons
                    name={option.icon}
                    size={25}
                    color={option.id === 'connect' ? '#FF2D55' : active ? '#F97316' : '#77736E'}
                  />
                </View>

                <View style={s.optionCopy}>
                  <Text style={s.optionTitle}>{option.title}</Text>
                  <Text style={s.optionDetail}>{option.detail}</Text>
                </View>

                <View style={[s.radio, active && s.radioActive]}>
                  {active && <Ionicons name="checkmark" size={17} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <PrimaryCTA
        label="Continue"
        disabled={selected === null}
        onPress={continueOnboarding}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 28,
    backgroundColor: '#FAFAF8',
  },
  content: { flex: 1 },
  description: {
    maxWidth: 360,
    marginTop: 12,
  },
  options: {
    gap: 12,
    marginTop: 38,
  },
  option: {
    minHeight: 104,
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderRadius: 24,
    backgroundColor: '#F1EEEA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionActive: {
    backgroundColor: '#FFF0E5',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 5,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  optionCopy: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    color: '#111111',
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 18,
    lineHeight: 22,
  },
  optionDetail: {
    color: '#77736E',
    fontFamily: 'Archivo_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
  },
  radio: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    backgroundColor: '#F97316',
  },
});
