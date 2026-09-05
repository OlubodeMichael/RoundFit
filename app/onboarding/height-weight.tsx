import { PrimaryCTA } from '@/components/onboarding/primary-cta';
import { OnboardingQuestion } from '@/components/onboarding/onboarding-question';
import { useOnboardingDraft } from '@/components/onboarding/onboarding-draft';
import { MeasurementPicker } from '@/components/onboarding/measurement-picker';
import { WhyWeAsk } from '@/components/onboarding/why-we-ask';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

// ── Conversion helpers ─────────────────────────────────────────────────────
// Store metric as precise floats; round only for display so every lb/in tick is reachable.
const KG_PER_LB = 2.20462;
const CM_PER_IN = 2.54;

const kgToLb  = (kg: number) => Math.round(kg * KG_PER_LB);
const lbToKg  = (lb: number) => lb / KG_PER_LB;
const cmToIn  = (cm: number) => Math.round(cm / CM_PER_IN);
const inToCm  = (i:  number) => i * CM_PER_IN;

function formatHeight(totalIn: number): string {
  const ft  = Math.floor(totalIn / 12);
  const ins = totalIn % 12;
  return `${ft}'${ins}"`;
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function HeightWeightScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string }>();
  const { draft, updateDraft } = useOnboardingDraft();

  // Internal values always stored in metric
  const { weightKg, heightCm, weightUnit, heightUnit } = draft;

  // Independent unit states per measurement

  // ── Weight derived values ───────────────────────────────────────────────
  const weightRulerValue   = weightUnit === 'kg' ? Math.round(weightKg) : kgToLb(weightKg);
  const weightMin          = weightUnit === 'kg' ? 30  : 66;
  const weightMax          = weightUnit === 'kg' ? 300 : 660;
  const weightDisplayValue = String(weightRulerValue);
  const weightDisplayUnit  = weightUnit === 'kg' ? 'kg' : 'lb';

  const onWeightChange = (v: number) => {
    updateDraft({ weightKg: weightUnit === 'kg' ? v : lbToKg(v) });
  };

  // ── Height derived values ───────────────────────────────────────────────
  const heightRulerValue   = heightUnit === 'cm' ? Math.round(heightCm) : cmToIn(heightCm);
  const heightMin          = heightUnit === 'cm' ? 100 : 39;
  const heightMax          = heightUnit === 'cm' ? 250 : 98;
  const heightDisplayValue = heightUnit === 'cm' ? String(heightRulerValue) : formatHeight(heightRulerValue);
  const heightDisplayUnit  = heightUnit === 'cm' ? 'cm' : '';

  const onHeightChange = (v: number) => {
    updateDraft({ heightCm: heightUnit === 'cm' ? v : inToCm(v) });
  };

  // Ruler label formatters
  const heightLabelFmt = heightUnit === 'in'
    ? (v: number) => `${Math.floor(v / 12)}'`
    : undefined;

  // Derive overall unit system for downstream param (imperial if either picker is imperial)
  const unitParam = weightUnit === 'lb' || heightUnit === 'in' ? 'imperial' : 'metric';

  return (
    <View style={s.root}>

      <OnboardingQuestion before="What are your " emphasis="height" after=" and weight?" />
      <WhyWeAsk
        text="We use this to calculate your personal calorie targets."
        style={s.whyWeAsk}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.measurementStack}>
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
              { label: 'lb', active: weightUnit === 'lb', onPress: () => updateDraft({ weightUnit: 'lb' }) },
              { label: 'kg', active: weightUnit === 'kg', onPress: () => updateDraft({ weightUnit: 'kg' }) },
            ]}
          />

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
              { label: 'ft · in', active: heightUnit === 'in', onPress: () => updateDraft({ heightUnit: 'in' }) },
              { label: 'cm', active: heightUnit === 'cm', onPress: () => updateDraft({ heightUnit: 'cm' }) },
            ]}
          />
        </View>
      </ScrollView>

      <PrimaryCTA
        label="Continue"
        onPress={() => router.push({
          pathname: '/onboarding/goal',
          params: {
            ...params,
            height: String(Math.round(heightCm)),
            weight: String(Math.round(weightKg)),
            unit:   unitParam,
          },
        })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 20,
  },
  whyWeAsk: {
    marginBottom: 16,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 12 },
  measurementStack: { gap: 40 },
});
