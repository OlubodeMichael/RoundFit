import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useFood } from '@/hooks/use-food';
import { useToast } from '@/components/ui/Toast';
import {
  AnimatedCard,
  FieldLabel,
  PrimaryButton,
  ScreenHeader,
  TextField,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import type { MealLabel } from '@/components/log/ManualMealInputModal';
import { MealLabelPicker, guessMealLabel } from '@/components/log/MealLabelPicker';
import { MacroInput } from '@/components/log/MacroInput';

function parseOptionalNumber(value: string): number | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

function sanitizeNumericInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  return cleaned.replace(/(\..*)\./g, '$1');
}

export default function ManualFoodScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const { addMeal } = useFood();
  const toast       = useToast();

  const [name,     setName]     = useState('');
  const [meal,     setMeal]     = useState<MealLabel>(guessMealLabel());
  const [cals,     setCals]     = useState('');
  const [protein,  setProtein]  = useState('');
  const [carbs,    setCarbs]    = useState('');
  const [fat,      setFat]      = useState('');
  const [saving,   setSaving]   = useState(false);

  const kcal = useMemo(() => parseOptionalNumber(cals), [cals]);

  const canSave = name.trim().length > 0 && typeof kcal === 'number' && kcal > 0;

  const handleSave = async () => {
    if (!canSave || typeof kcal !== 'number') {
      toast.warning('Missing info', 'Add a name and calories.');
      return;
    }
    setSaving(true);
    try {
      await addMeal({
        name:     name.trim(),
        label:    meal,
        calories: kcal,
        protein:  parseOptionalNumber(protein),
        carbs:    parseOptionalNumber(carbs),
        fat:      parseOptionalNumber(fat),
      });
      toast.success('Food logged', name.trim());
      router.back();
    } catch {
      toast.error('Could not log', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader eyebrow="New entry" title="Manual" accent={P.protein} />

        {/* ── Name ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <AnimatedCard delay={60}>
            <FieldLabel>What did you eat</FieldLabel>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="Chicken salad"
              autoCapitalize="sentences"
              autoFocus
            />
          </AnimatedCard>
        </View>

        {/* ── Meal ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={120}>
            <FieldLabel>Meal</FieldLabel>
            <MealLabelPicker value={meal} onChange={setMeal} accent={P.protein} />
          </AnimatedCard>
        </View>

        {/* ── Calories hero ───────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={180}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              <View style={[styles.flame, { backgroundColor: P.caloriesSoft }]}>
                <Ionicons name="flame" size={18} color={P.calories} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kcalEyebrow, { color: P.textFaint }]}>CALORIES</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <TextInput
                    value={cals}
                    onChangeText={(t) => setCals(sanitizeNumericInput(t))}
                    placeholder="0"
                    placeholderTextColor={P.textFaint}
                    keyboardType="number-pad"
                    style={[styles.kcalInput, { color: P.text }]}
                  />
                  <Text style={[styles.kcalUnit, { color: P.textDim }]}>  kcal</Text>
                </View>
              </View>
            </View>
          </AnimatedCard>
        </View>

        {/* ── Macros ──────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={240}>
            <FieldLabel>Macros (optional)</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
              <MacroInput label="Protein" value={protein} onChange={setProtein} color={P.protein} />
              <MacroInput label="Carbs"   value={carbs}   onChange={setCarbs}   color={P.carbs}   />
              <MacroInput label="Fat"     value={fat}     onChange={setFat}     color={P.fat}     />
            </View>
          </AnimatedCard>
        </View>

        {/* ── CTA ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <PrimaryButton
            label={canSave ? `Log ${kcal} kcal` : 'Log meal'}
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            disabled={!canSave}
            accent={P.protein}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flame: {
    width:          46, height: 46, borderRadius: 15,
    alignItems:     'center',
    justifyContent: 'center',
  },
  kcalEyebrow: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.5,
    marginBottom:  2,
  },
  kcalInput: {
    fontSize:      40,
    fontWeight:    '800',
    letterSpacing: -1.6,
    padding:       0,
    minWidth:      70,
  },
  kcalUnit: {
    fontSize:      14,
    fontWeight:    '800',
    letterSpacing: 0.4,
  },
});
