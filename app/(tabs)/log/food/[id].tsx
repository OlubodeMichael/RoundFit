import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useFood } from '@/hooks/use-food';
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

// Mock catalog — should match food/search.tsx. In production this is fetched.
const CATALOG: Record<string, {
  id: string; name: string; brand: string;
  servings: { label: string; grams: number; kcal: number; p: number; c: number; f: number }[];
}> = {
  '1':  { id: '1',  name: 'Grilled chicken breast', brand: 'Whole Foods',    servings: [
    { label: '100 g',       grams: 100,  kcal: 165, p: 31, c: 0,  f: 3.6 },
    { label: '1 breast',    grams: 170,  kcal: 280, p: 53, c: 0,  f: 6   },
    { label: '1 oz',        grams: 28,   kcal: 47,  p: 9,  c: 0,  f: 1   },
  ]},
  '2':  { id: '2',  name: 'Greek yogurt',           brand: 'Fage · 2%',      servings: [
    { label: '170 g',       grams: 170,  kcal: 120, p: 17, c: 6,  f: 3   },
    { label: '1 tbsp',      grams: 15,   kcal: 11,  p: 1.5,c: 0.5,f: 0.3 },
  ]},
  '3':  { id: '3',  name: 'Oatmeal',                brand: "Bob's Red Mill", servings: [
    { label: '40 g',        grams: 40,   kcal: 150, p: 5,  c: 27, f: 3   },
  ]},
  '4':  { id: '4',  name: 'Banana',                 brand: 'Fresh',          servings: [
    { label: '1 medium',    grams: 118,  kcal: 105, p: 1.3,c: 27, f: 0.4 },
  ]},
  '5':  { id: '5',  name: 'Almonds',                brand: 'Blue Diamond',   servings: [
    { label: '1 oz (28 g)', grams: 28,   kcal: 160, p: 6,  c: 6,  f: 14  },
  ]},
  '6':  { id: '6',  name: 'Brown rice',             brand: "Uncle Ben's",    servings: [
    { label: '1 cup',       grams: 195,  kcal: 215, p: 5,  c: 45, f: 1.8 },
  ]},
  '7':  { id: '7',  name: 'Salmon fillet',          brand: 'Atlantic',       servings: [
    { label: '100 g',       grams: 100,  kcal: 208, p: 20, c: 0,  f: 13  },
  ]},
  '8':  { id: '8',  name: 'Avocado',                brand: 'Hass',           servings: [
    { label: '1 medium',    grams: 150,  kcal: 240, p: 3,  c: 12, f: 22  },
  ]},
  '9':  { id: '9',  name: 'Egg, large',             brand: 'Cage-free',      servings: [
    { label: '1 egg',       grams: 50,   kcal: 78,  p: 6,  c: 0.6,f: 5   },
  ]},
  '10': { id: '10', name: 'Peanut butter',          brand: 'Jif · natural',  servings: [
    { label: '2 tbsp',      grams: 32,   kcal: 190, p: 8,  c: 7,  f: 16  },
  ]},
};

export default function FoodDetailScreen() {
  const P       = usePalette();
  const router  = useRouter();
  const pad     = useScreenPadding();
  const insets  = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { addMeal } = useFood();
  const toast       = useToast();

  const food = id ? CATALOG[id] : undefined;

  const [servingIdx, setServingIdx] = useState(0);
  const [qty,        setQty]        = useState('1');
  const [meal,       setMeal]       = useState<MealLabel>(guessMealLabel());
  const [saving,     setSaving]     = useState(false);

  const multiplier = useMemo(() => {
    const n = parseFloat(qty);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [qty]);

  const live = useMemo(() => {
    if (!food) return { kcal: 0, p: 0, c: 0, f: 0 };
    const s = food.servings[servingIdx];
    return {
      kcal: Math.round(s.kcal * multiplier),
      p:    +(s.p * multiplier).toFixed(1),
      c:    +(s.c * multiplier).toFixed(1),
      f:    +(s.f * multiplier).toFixed(1),
    };
  }, [food, servingIdx, multiplier]);

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
    if (multiplier <= 0) {
      toast.warning('Invalid amount', 'Enter how many servings.');
      return;
    }
    setSaving(true);
    try {
      await addMeal({
        name:     food.name,
        label:    meal,
        calories: live.kcal,
        protein:  live.p,
        carbs:    live.c,
        fat:      live.f,
      });
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
        <ScreenHeader eyebrow={food.brand} title={food.name} />

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
                    {live.kcal}
                  </Text>
                  <Text style={[styles.heroUnit, { color: P.textDim }]}>  kcal</Text>
                </View>
              </View>
              <View style={[styles.heroIcon, { backgroundColor: P.caloriesSoft }]}>
                <Ionicons name="flame" size={20} color={P.calories} />
              </View>
            </View>

            <View style={[styles.macroRow, { borderTopColor: P.hair }]}>
              <Macro label="PROTEIN" value={live.p} unit="g" color={P.protein} P={P} />
              <View style={[styles.vDiv, { backgroundColor: P.hair }]} />
              <Macro label="CARBS"   value={live.c} unit="g" color={P.carbs}   P={P} />
              <View style={[styles.vDiv, { backgroundColor: P.hair }]} />
              <Macro label="FAT"     value={live.f} unit="g" color={P.fat}     P={P} />
            </View>
          </AnimatedCard>
        </View>

        {/* ── Serving picker + qty ─────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={120}>
            <FieldLabel>Serving size</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              {food.servings.map((s, i) => {
                const active = i === servingIdx;
                return (
                  <Pressable
                    key={s.label}
                    onPress={() => setServingIdx(i)}
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
                      {s.label}
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
            label={`Log ${live.kcal} kcal`}
            icon="checkmark"
            onPress={handleLog}
            loading={saving}
          />
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
