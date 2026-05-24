import { ProgressBar } from '@/components/onboarding/progress-bar';
import { MeasurementPicker } from '@/components/onboarding/measurement-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Conversion helpers ─────────────────────────────────────────────────────
const kgToLb  = (kg: number) => Math.round(kg  * 2.20462);
const lbToKg  = (lb: number) => Math.round(lb  / 2.20462);
const cmToIn  = (cm: number) => Math.round(cm  / 2.54);
const inToCm  = (i:  number) => Math.round(i   * 2.54);

function formatHeight(totalIn: number): string {
  const ft  = Math.floor(totalIn / 12);
  const ins = totalIn % 12;
  return `${ft}'${ins}"`;
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function HeightWeightScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string }>();
  const insets = useSafeAreaInsets();

  // Internal values always stored in metric
  const [weightKg, setWeightKg] = useState(70);
  const [heightCm, setHeightCm] = useState(172);

  // Independent unit states per measurement
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'in'>('cm');

  // ── Weight derived values ───────────────────────────────────────────────
  const weightRulerValue   = weightUnit === 'kg' ? weightKg : kgToLb(weightKg);
  const weightMin          = weightUnit === 'kg' ? 30  : 66;
  const weightMax          = weightUnit === 'kg' ? 300 : 660;
  const weightDisplayValue = String(weightRulerValue);
  const weightDisplayUnit  = weightUnit === 'kg' ? 'kg' : 'lb';

  const onWeightChange = (v: number) => {
    setWeightKg(weightUnit === 'kg' ? v : lbToKg(v));
  };

  // ── Height derived values ───────────────────────────────────────────────
  const heightRulerValue   = heightUnit === 'cm' ? heightCm : cmToIn(heightCm);
  const heightMin          = heightUnit === 'cm' ? 100 : 39;
  const heightMax          = heightUnit === 'cm' ? 250 : 98;
  const heightDisplayValue = heightUnit === 'cm' ? String(heightCm) : formatHeight(cmToIn(heightCm));
  const heightDisplayUnit  = heightUnit === 'cm' ? 'cm' : '';

  const onHeightChange = (v: number) => {
    setHeightCm(heightUnit === 'cm' ? v : inToCm(v));
  };

  // Ruler label formatters
  const heightLabelFmt = heightUnit === 'in'
    ? (v: number) => `${Math.floor(v / 12)}'`
    : undefined;

  // Derive overall unit system for downstream param (imperial if either picker is imperial)
  const unitParam = weightUnit === 'lb' || heightUnit === 'in' ? 'imperial' : 'metric';

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <View style={s.progress}>
        <ProgressBar step={4} total={9} backHref="/onboarding/age-sex" isDark={false} />
      </View>

      <Text style={s.headline}>Height &{'\n'}weight.</Text>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Weight ─────────────────────────────────────────────────────── */}
        <MeasurementPicker
          label="Weight"
          value={weightRulerValue}
          onChange={onWeightChange}
          displayValue={weightDisplayValue}
          displayUnit={weightDisplayUnit}
          min={weightMin}
          max={weightMax}
          majorEvery={5}
          labelEvery={10}
          tickSpacing={8}
          unitOptions={[
            { label: 'Kg',    active: weightUnit === 'kg', onPress: () => setWeightUnit('kg') },
            { label: 'Pound', active: weightUnit === 'lb', onPress: () => setWeightUnit('lb') },
          ]}
        />

        <View style={s.spacer} />

        {/* ── Height ─────────────────────────────────────────────────────── */}
        <MeasurementPicker
          label="Height"
          value={heightRulerValue}
          onChange={onHeightChange}
          displayValue={heightDisplayValue}
          displayUnit={heightDisplayUnit}
          min={heightMin}
          max={heightMax}
          majorEvery={heightUnit === 'in' ? 12 : 5}
          labelEvery={heightUnit === 'in' ? 12 : 10}
          formatLabel={heightLabelFmt}
          tickSpacing={heightUnit === 'in' ? 14 : 8}
          unitOptions={[
            { label: 'Feet',   active: heightUnit === 'in', onPress: () => setHeightUnit('in') },
            { label: 'Meters', active: heightUnit === 'cm', onPress: () => setHeightUnit('cm') },
          ]}
        />
      </ScrollView>

      <TouchableOpacity
        style={s.cta}
        activeOpacity={0.88}
        onPress={() => router.push({
          pathname: '/onboarding/goal',
          params: {
            ...params,
            height: String(heightCm),
            weight: String(weightKg),
            unit:   unitParam,
          },
        })}
      >
        <Text style={s.ctaText}>Continue  →</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex:             1,
    backgroundColor:  '#FAFAF8',
    paddingHorizontal: 20,
  },
  progress:  { marginBottom: 4 },
  headline: {
    fontSize:      40,
    fontWeight:    '900',
    letterSpacing: -2,
    lineHeight:    44,
    color:         '#111111',
    marginBottom:  24,
  },

  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  spacer:        { height: 14 },

  cta: {
    marginTop:       16,
    backgroundColor: '#111111',
    borderRadius:    16,
    paddingVertical: 18,
    alignItems:      'center',
  },
  ctaText: {
    color:         '#FFFFFF',
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: 0.2,
  },
});
