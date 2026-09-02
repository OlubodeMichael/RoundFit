import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';

export default function UnitsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string; goal: string; activity: string;
  }>();
  const [unit, setUnit] = useState<'metric' | 'imperial'>('imperial');

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
      key:    'metric'   as const,
      label:  'Metric',
      units:  'kg · cm',
    },
    {
      key:    'imperial' as const,
      label:  'Imperial',
      units:  'lb · ft',
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
        <View style={s.switchTrack} accessibilityRole="radiogroup">
          {OPTIONS.map((option) => {
            const active = unit === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[s.switchOption, active && s.switchOptionActive]}
                onPress={() => setUnit(option.key)}
                activeOpacity={0.82}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${option.label}, ${option.units}`}
              >
                <Text style={[s.switchLabel, active && s.switchLabelActive]}>{option.label}</Text>
                <Text style={[s.switchUnits, active && s.switchUnitsActive]}>{option.units}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.previewCard}>
          <View style={s.previewHeader}>
            <Text style={s.previewEyebrow}>YOUR MEASUREMENTS</Text>
            <View style={s.systemPill}>
              <Text style={s.systemPillText}>{unit === 'metric' ? 'METRIC' : 'IMPERIAL'}</Text>
            </View>
          </View>

          <View style={s.measurements}>
            <View style={s.measurement}>
              <Text style={s.measurementLabel}>Weight</Text>
              <Text style={s.measurementValue} adjustsFontSizeToFit numberOfLines={1}>{preview.weight}</Text>
            </View>
            <View style={s.measurementDivider} />
            <View style={s.measurement}>
              <Text style={s.measurementLabel}>Height</Text>
              <Text style={s.measurementValue} adjustsFontSizeToFit numberOfLines={1}>{preview.height}</Text>
            </View>
          </View>

          <View style={s.distanceRow}>
            <Text style={s.distanceLabel}>Distance and speed</Text>
            <Text style={s.distanceValue}>{preview.distance}</Text>
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
          pathname: '/onboarding/name',
          params: { ...params, unit },
        })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF8', paddingHorizontal: 28 },
  whyWeAsk: { marginBottom: 22 },
  unitControl: { gap: 14, marginBottom: 18 },
  switchTrack: {
    flexDirection: 'row',
    gap: 5,
    padding: 5,
    borderRadius: 22,
    backgroundColor: '#EDE9E4',
  },
  switchOption: {
    flex: 1,
    minHeight: 66,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  switchOptionActive: { backgroundColor: '#F97316' },
  switchLabel: { fontFamily: 'Archivo_600SemiBold', fontSize: 16, color: '#625D57' },
  switchLabelActive: { color: '#FFFFFF' },
  switchUnits: { fontFamily: 'Archivo_500Medium', fontSize: 11, color: '#9A948D' },
  switchUnitsActive: { color: 'rgba(255,255,255,0.72)' },
  previewCard: {
    overflow: 'hidden',
    padding: 22,
    borderRadius: 28,
    backgroundColor: '#111111',
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  previewEyebrow: { fontFamily: 'Archivo_600SemiBold', fontSize: 10, letterSpacing: 1.3, color: '#777777' },
  systemPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#2B2B2B' },
  systemPillText: { fontFamily: 'Archivo_600SemiBold', fontSize: 9, letterSpacing: 0.9, color: '#F97316' },
  measurements: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 24 },
  measurement: { flex: 1, gap: 7 },
  measurementDivider: { width: 1, marginHorizontal: 18, backgroundColor: '#303030' },
  measurementLabel: { fontFamily: 'Archivo_400Regular', fontSize: 13, color: '#888888' },
  measurementValue: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -1,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2B2B2B',
  },
  distanceLabel: { fontFamily: 'Archivo_400Regular', fontSize: 13, color: '#888888' },
  distanceValue: { fontFamily: 'Archivo_600SemiBold', fontSize: 14, color: '#F97316' },
  note: { fontFamily: 'Archivo_400Regular', fontSize: 13, lineHeight: 18, color: '#AAA7AD', textAlign: 'center' },
  noteBold: { fontFamily: 'Archivo_600SemiBold', color: '#77747A' },
});
