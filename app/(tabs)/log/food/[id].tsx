import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  useFood,
  defaultPortion,
  macrosForGrams,
  type Food,
  type FoodPortion,
} from '@/hooks/use-food';
import { useToast } from '@/components/ui/Toast';
import {
  AnimatedCard,
  FieldLabel,
  PrimaryButton,
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import type { MealLabel } from '@/components/log/ManualMealInputModal';
import { MealLabelPicker, guessMealLabel } from '@/components/log/MealLabelPicker';
import { QuantityStepper } from '@/components/log/QuantityStepper';

export default function FoodDetailScreen() {
  const P       = usePalette();
  const router  = useRouter();
  const pad     = useScreenPadding();
  const insets  = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { getFood, logFoodById } = useFood();
  const toast   = useToast();

  const [food,    setFood]    = useState<Food | null>(null);
  const [loading, setLoading] = useState(true);

  const [portionIdx, setPortionIdx] = useState(0);
  const [qty,        setQty]        = useState('1');
  const [meal,       setMeal]       = useState<MealLabel>(guessMealLabel());
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      const result = await getFood(id);
      if (cancelled) return;

      setFood(result);
      if (result) {
        // Preselect the provider's own default (a labelled serving for packaged
        // foods, 100 g for generic ones) rather than whatever sorts first.
        const preferred = defaultPortion(result);
        const index = result.portions.findIndex((p) => p.grams === preferred.grams);
        setPortionIdx(index === -1 ? 0 : index);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [id, getFood]);

  const multiplier = useMemo(() => {
    const n = parseFloat(qty);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [qty]);

  const portion: FoodPortion | undefined = food?.portions[portionIdx];
  const grams = portion ? portion.grams * multiplier : 0;

  // Recomputed from per-100g on every change, so any portion/quantity combination
  // stays consistent without another lookup.
  const live = useMemo(() => {
    if (!food) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    return macrosForGrams(food, grams);
  }, [food, grams]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={P.calories} />
      </View>
    );
  }

  if (!food) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        <View style={{ paddingTop: pad.paddingTop }}>
          <ScreenHeader eyebrow="Food" title="Not found" />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 10 }}>
          <Ionicons name="help-circle-outline" size={28} color={P.textFaint} />
          <Text style={{ color: P.text, fontSize: 15, fontWeight: '700' }}>
            {"We couldn't find this food."}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backCta, { backgroundColor: P.calories }]}
          >
            <Text style={styles.backCtaText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleLog = async () => {
    if (multiplier <= 0 || grams <= 0) {
      toast.warning('Invalid amount', 'Enter how many servings.');
      return;
    }
    setSaving(true);
    try {
      await logFoodById(food, grams, meal);
      toast.success('Food logged', food.name);
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
        <ScreenHeader
          eyebrow={food.brand ?? (food.verified ? 'Generic' : 'Food')}
          title={food.name}
        />

        {/* ── Live macro hero ─────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <AnimatedCard delay={60}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroEyebrow, { color: P.textFaint }]}>
                  FOR YOUR SELECTION
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={[styles.heroBig, { color: P.text }]}>
                    {live.calories}
                  </Text>
                  <Text style={[styles.heroUnit, { color: P.textDim }]}>  kcal</Text>
                </View>
                {grams > 0 && (
                  <Text style={[styles.heroGrams, { color: P.textFaint }]}>
                    {Math.round(grams)} g
                  </Text>
                )}
              </View>
              <View style={[styles.heroIcon, { backgroundColor: P.caloriesSoft }]}>
                <Ionicons name="flame" size={20} color={P.calories} />
              </View>
            </View>

            <View style={[styles.macroRow, { borderTopColor: P.hair }]}>
              <Macro label="PROTEIN" value={live.protein} unit="g" color={P.protein} P={P} />
              <View style={[styles.vDiv, { backgroundColor: P.hair }]} />
              <Macro label="CARBS"   value={live.carbs}   unit="g" color={P.carbs}   P={P} />
              <View style={[styles.vDiv, { backgroundColor: P.hair }]} />
              <Macro label="FAT"     value={live.fat}     unit="g" color={P.fat}     P={P} />
            </View>
          </AnimatedCard>
        </View>

        {/* ── Serving picker + qty ─────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={120}>
            <FieldLabel>Serving size</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              {food.portions.map((p, i) => {
                const active = i === portionIdx;
                return (
                  <Pressable
                    key={`${p.label}-${p.grams}`}
                    onPress={() => setPortionIdx(i)}
                    style={({ pressed }) => [
                      styles.servingPill,
                      {
                        backgroundColor: active ? P.calories : P.sunken,
                        borderColor:     active ? P.calories : P.cardEdge,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={[
                      styles.servingText,
                      { color: active ? '#fff' : P.text },
                    ]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ height: 14 }} />
            <FieldLabel>How many servings</FieldLabel>
            <QuantityStepper value={qty} onChange={setQty} step={0.5} />
          </AnimatedCard>
        </View>

        {/* ── Meal selector ─────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={180}>
            <FieldLabel>Log to</FieldLabel>
            <MealLabelPicker value={meal} onChange={setMeal} />
          </AnimatedCard>
        </View>

        {/* ── CTA ───────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <PrimaryButton
            label={`Log ${live.calories} kcal`}
            icon="checkmark"
            onPress={handleLog}
            loading={saving}
          />
        </View>

        {/* ── Data source ───────────────────────────── */}
        {/* Open Food Facts is ODbL-licensed and requires attribution. */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Text style={[styles.attribution, { color: P.textFaint }]}>
            {food.source === 'openfoodfacts'
              ? 'Nutrition data: Open Food Facts (ODbL)'
              : food.source === 'usda'
                ? 'Nutrition data: USDA FoodData Central'
                : 'Your custom food'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Macro cell ─────────────────────────────────────────────────────────────
function Macro({
  label, value, unit, color, P,
}: {
  label: string; value: number; unit: string; color: string;
  P: ReturnType<typeof usePalette>;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <Text style={{ color: P.textFaint, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text style={{ color, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 }}>
          {value}
        </Text>
        <Text style={{ color: P.textFaint, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 }}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  heroEyebrow: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.5,
    marginBottom:  2,
  },
  heroBig: {
    fontSize:      44,
    fontWeight:    '800',
    letterSpacing: -1.8,
    lineHeight:    48,
  },
  heroUnit: {
    fontSize:      14,
    fontWeight:    '800',
    letterSpacing: 0.4,
  },
  heroGrams: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 0.2,
    marginTop:     2,
  },
  heroIcon: {
    width:          46, height: 46, borderRadius: 15,
    alignItems:     'center',
    justifyContent: 'center',
  },
  macroRow: {
    flexDirection: 'row',
    marginTop:     16,
    paddingTop:    14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  vDiv: {
    width: StyleSheet.hairlineWidth,
  },

  servingPill: {
    paddingHorizontal:14,
    paddingVertical:  9,
    borderRadius:     999,
    borderWidth:      StyleSheet.hairlineWidth,
  },
  servingText: {
    fontSize:      12,
    fontWeight:    '800',
    letterSpacing: -0.1,
  },

  attribution: {
    fontSize:      10,
    fontWeight:    '600',
    letterSpacing: 0.2,
    textAlign:     'center',
  },

  backCta: {
    paddingHorizontal:18,
    paddingVertical:  10,
    borderRadius:     12,
    marginTop:        8,
  },
  backCtaText: {
    color:          '#fff',
    fontSize:       13,
    fontWeight:     '800',
    letterSpacing:  0.1,
  },
});
