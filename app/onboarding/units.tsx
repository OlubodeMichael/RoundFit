import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';

export default function UnitsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string; goal: string; activity: string;
  }>();
  const { draft, updateDraft } = useOnboardingDraft();
  const { unit } = draft;

  const weightKg = Number(params.weight) || 70;
  const heightCm = Number(params.height) || 170;
  const weightLb = Math.round(weightKg * 2.20462);
  const totalInches = Math.round(heightCm / 2.54);
  const heightFeet = Math.floor(totalInches / 12);
  const heightInches = totalInches % 12;

  const preview = unit === 'metric'
    ? { weight: `${Math.round(weightKg)} kg`, height: `${Math.round(heightCm)} cm`, distance: 'km' }
    : { weight: `${weightLb} lb`, height: `${heightFeet}′ ${heightInches}″`, distance: 'mi' };

  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(24)).current;
  const panelFade = useRef(new Animated.Value(0)).current;
  const panelY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(panelFade, { toValue: 1, duration: 420, delay: 140, useNativeDriver: true }),
      Animated.timing(panelY, { toValue: 0, duration: 380, delay: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const OPTIONS = [
    {
      key:    'imperial' as const,
      label:  'Imperial',
      units:  'lb  ·  ft & in  ·  mi',
      description: 'Pounds, feet, inches and miles',
    },
    {
      key:    'metric'   as const,
      label:  'Metric',
      units:  'kg  ·  cm  ·  km',
      description: 'Kilograms, centimetres and kilometres',
    },
  ];

  return (
    <View style={s.root}>

      <View style={{ flex: 1 }}>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
        <OnboardingQuestion before="Which " emphasis="units" after=" feel familiar?" />
        <WhyWeAsk
          text="We use this to show weights and measurements in the format you prefer."
          style={s.whyWeAsk}
        />
      </Animated.View>

      <Animated.View style={[s.unitControl, { opacity: panelFade, transform: [{ translateY: panelY }] }]}>
        <View style={s.optionList} accessibilityRole="radiogroup">
          {OPTIONS.map((option) => {
            const active = unit === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[s.unitOption, active && s.unitOptionActive]}
                onPress={() => updateDraft({ unit: option.key })}
                activeOpacity={0.82}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${option.label}. ${option.description}`}
              >
                <View style={s.optionCopy}>
                  <View style={s.optionTitleRow}>
                    <Text style={[s.optionLabel, active && s.optionLabelActive]}>{option.label}</Text>
                    {option.key === 'imperial' && (
                      <View style={[s.defaultPill, active && s.defaultPillActive]}>
                        <Text style={[s.defaultText, active && s.defaultTextActive]}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.optionUnits, active && s.optionUnitsActive]}>{option.units}</Text>
                  <Text style={[s.optionDescription, active && s.optionDescriptionActive]}>
                    {option.description}
                  </Text>
                </View>

                <View style={[s.selection, active && s.selectionActive]}>
                  {active && <Ionicons name="checkmark" size={15} color="#F97316" />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.exampleRow}>
          <View style={s.exampleIcon}>
            <Ionicons name="eye-outline" size={19} color="#F97316" />
          </View>
          <View style={s.exampleCopy}>
            <Text style={s.exampleLabel}>Your measurements will look like</Text>
            <Text style={s.exampleValue}>
              {preview.weight}  ·  {preview.height}  ·  {preview.distance}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Footer note */}
      <Animated.View style={{ opacity: fade }}>
        <Text style={s.note}>
          You can switch any time in <Text style={s.noteBold}>Profile {'→'} Preferences</Text>.
        </Text>
      </Animated.View>
      </View>

      <PrimaryCTA
        label="Continue"
        onPress={() => router.push({
          pathname: '/onboarding/health-choice',
          params: { ...params, unit },
        })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8', paddingHorizontal: 28 },
  whyWeAsk: { marginBottom: 22 },
  unitControl: { gap: 16, marginBottom: 18 },
  optionList: { gap: 12 },
  unitOption: {
    minHeight: 108,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#F0ECE7',
  },
  unitOptionActive: {
    backgroundColor: '#F97316',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  optionCopy: { flex: 1, gap: 4, paddingRight: 16 },
  optionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionLabel: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 18,
    letterSpacing: -0.3,
    color: '#111111',
  },
  optionLabelActive: { color: '#FFFFFF' },
  optionUnits: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.15,
    color: '#F97316',
  },
  optionUnitsActive: { color: '#FFFFFF' },
  optionDescription: {
    fontFamily: 'Archivo_400Regular',
    fontSize: 12.5,
    lineHeight: 17,
    color: '#7C766F',
  },
  optionDescriptionActive: { color: 'rgba(255,255,255,0.78)' },
  defaultPill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  defaultPillActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  defaultText: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 8,
    letterSpacing: 0.8,
    color: '#F97316',
  },
  defaultTextActive: { color: '#FFFFFF' },
  selection: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D2CBC4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionActive: { borderColor: '#FFFFFF' },
  exampleRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#FFF1E7',
  },
  exampleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  exampleCopy: { flex: 1, gap: 3 },
  exampleLabel: { fontFamily: 'Archivo_400Regular', fontSize: 12, color: '#8B694F' },
  exampleValue: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 16,
    letterSpacing: -0.25,
    color: '#111111',
    fontVariant: ['tabular-nums'],
  },
  note: { fontFamily: 'Archivo_400Regular', fontSize: 13, lineHeight: 18, color: '#AAA7AD', textAlign: 'center' },
  noteBold: { fontFamily: 'Archivo_600SemiBold', color: '#77747A' },
});
