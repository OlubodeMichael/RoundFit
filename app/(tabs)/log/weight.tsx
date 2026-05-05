import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  AnimatedCard,
  PrimaryButton,
  Tip,
  usePalette,
} from '@/lib/log-theme';
import { useToast } from '@/components/ui/Toast';
import { useWeight } from '@/hooks/use-weight';
import { useProfile } from '@/hooks/use-profile';
import { useUnits } from '@/hooks/use-units';

type Unit = 'lb' | 'kg';

export default function WeightLogScreen() {
  const P      = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast  = useToast();
  const { latest, logWeight } = useWeight();
  const { profile, updateProfile } = useProfile();
  const { weightUnit, toDisplayWeight, toKg } = useUnits();

  const defaultUnit: Unit = weightUnit;
  const latestWeightKg    = latest?.weight_kg ?? profile?.weightKg ?? null;
  const initialValue      = latestWeightKg === null
    ? ''
    : toDisplayWeight(latestWeightKg).toFixed(1);

  const [unit, setUnit]     = useState<Unit>(defaultUnit);
  const [value, setValue]   = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUnit(defaultUnit);
    if (latestWeightKg === null) {
      setValue('');
      return;
    }
    setValue(toDisplayWeight(latestWeightKg).toFixed(1));
  }, [defaultUnit, latestWeightKg, toDisplayWeight]);

  const numeric = useMemo(() => parseFloat(value), [value]);
  const previous = useMemo(
    () => (latestWeightKg === null ? null : convert(latestWeightKg, 'kg', unit)),
    [latestWeightKg, unit],
  );
  const delta = useMemo(() => {
    if (!Number.isFinite(numeric) || previous === null) return null;
    return numeric - previous;
  }, [numeric, previous]);

  const switchUnit = (u: Unit) => {
    if (u === unit) return;
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) setValue(convert(parsed, unit, u).toFixed(1));
    setUnit(u);
  };

  const nudge = (step: number) => {
    const curr = parseFloat(value);
    if (!Number.isFinite(curr)) return;
    setValue(Math.max(0, curr + step).toFixed(1));
  };

  const handleSave = async () => {
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.warning('Invalid weight', 'Enter a positive number.');
      return;
    }
    const kg = toKg(numeric, unit);
    setSaving(true);
    try {
      await logWeight(kg, unit === 'lb' ? 'imperial' : 'metric');
      await updateProfile({ weightKg: kg });
      toast.success('Saved', `${numeric.toFixed(1)} ${unit}`);
      router.back();
    } catch {
      toast.error('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const acc = P.weight;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.backBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={P.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[styles.eyebrow, { color: P.textFaint }]}>BODY METRICS</Text>
          <Text style={[styles.title, { color: P.text }]}>
            Weight<Text style={{ color: acc }}>.</Text>
          </Text>
        </View>

        {/* Inline unit toggle */}
        <View style={[styles.unitToggle, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
          {(['lb', 'kg'] as Unit[]).map((u) => {
            const active = u === unit;
            return (
              <Pressable
                key={u}
                onPress={() => switchUnit(u)}
                style={[styles.unitBtn, active && { backgroundColor: acc }]}
              >
                <Text style={[styles.unitText, { color: active ? '#fff' : P.textDim }]}>
                  {u.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero card ──────────────────────────────────────────────── */}
        <AnimatedCard delay={60} padding={0} style={{ overflow: 'hidden', marginTop: 4 }}>
          {/* Accent stripe */}
          <View style={[styles.stripe, { backgroundColor: acc }]} />

          <View style={{ padding: 24 }}>
            {/* Card label */}
            <View style={styles.cardLabelRow}>
              <View style={[styles.labelPuck, { backgroundColor: acc + '22' }]}>
                <Ionicons name="scale-outline" size={13} color={acc} />
              </View>
              <Text style={[styles.cardLabel, { color: P.textFaint }]}>CURRENT WEIGHT</Text>
            </View>

            {/* Large weight input */}
            <View style={styles.inputRow}>
              <TextInput
                value={value}
                onChangeText={(t) =>
                  setValue(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))
                }
                keyboardType="decimal-pad"
                selectionColor={acc}
                style={[styles.bigInput, { color: value ? P.text : P.textFaint }]}
                placeholder="—"
                placeholderTextColor={P.textFaint}
                maxLength={6}
              />
              <Text style={[styles.bigUnit, { color: acc }]}>{unit}</Text>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: P.hair }]} />

            {/* Delta + previous */}
            <View style={{ gap: 10 }}>
              {delta !== null ? (
                <View style={[styles.deltaPill, { backgroundColor: deltaColor(P, delta) + '1A' }]}>
                  <Ionicons
                    name={delta === 0 ? 'remove' : delta < 0 ? 'trending-down' : 'trending-up'}
                    size={13}
                    color={deltaColor(P, delta)}
                  />
                  <Text style={[styles.deltaText, { color: deltaColor(P, delta) }]}>
                    {delta === 0
                      ? 'No change from last entry'
                      : `${Math.abs(delta).toFixed(1)} ${unit} ${delta < 0 ? 'down' : 'up'} from last`}
                  </Text>
                </View>
              ) : (
                <View style={[styles.deltaPill, { backgroundColor: P.sunken }]}>
                  <Ionicons name="add-circle-outline" size={13} color={P.textFaint} />
                  <Text style={[styles.deltaText, { color: P.textFaint }]}>
                    First entry — establishing your baseline
                  </Text>
                </View>
              )}

              {previous !== null && (
                <Text style={[styles.prevText, { color: P.textFaint }]}>
                  Previous: {previous.toFixed(1)} {unit}
                </Text>
              )}
            </View>
          </View>
        </AnimatedCard>

        {/* ── Quick adjust ────────────────────────────────────────────── */}
        <View style={{ marginTop: 12 }}>
          <AnimatedCard delay={140}>
            <Text style={[styles.sectionLabel, { color: P.textFaint }]}>FINE TUNE</Text>
            <View style={styles.stepRow}>
              {/* Decrease group */}
              <View style={styles.stepGroup}>
                {[-1, -0.1].map((step) => (
                  <Pressable
                    key={step}
                    onPress={() => nudge(step)}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      { backgroundColor: P.sunken, borderColor: P.cardEdge },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={[styles.stepText, { color: P.textDim }]}>{step}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.stepSep, { backgroundColor: P.hair }]} />

              {/* Increase group */}
              <View style={styles.stepGroup}>
                {[0.1, 1].map((step) => (
                  <Pressable
                    key={step}
                    onPress={() => nudge(step)}
                    style={({ pressed }) => [
                      styles.stepBtn,
                      { backgroundColor: acc + '15', borderColor: acc + '30' },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={[styles.stepText, { color: acc }]}>+{step}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </AnimatedCard>
        </View>

        {/* ── Tip ─────────────────────────────────────────────────────── */}
        <View style={{ marginTop: 12 }}>
          <AnimatedCard delay={200} padding={14}>
            <Tip icon="time-outline" tint={acc}>
              Weigh at the same time daily — morning, after restroom, before food or water gives the most consistent reading.
            </Tip>
          </AnimatedCard>
        </View>

        {/* ── Save button ─────────────────────────────────────────────── */}
        <View style={{ marginTop: 22 }}>
          <PrimaryButton
            label="Save Weight"
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            accent={acc}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function convert(val: number, from: Unit, to: Unit): number {
  if (from === to) return val;
  return from === 'lb' ? val / 2.20462 : val * 2.20462;
}

function deltaColor(P: ReturnType<typeof usePalette>, d: number): string {
  if (d === 0) return P.textDim;
  return d < 0 ? P.protein : P.carbs;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal:20,
    paddingBottom:    16,
  },
  backBtn: {
    width:          40, height: 40, borderRadius: 14,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    StyleSheet.hairlineWidth,
  },
  eyebrow: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  2,
  },
  title: {
    fontSize:      24,
    fontWeight:    '800',
    letterSpacing: -0.6,
  },
  unitToggle: {
    flexDirection: 'row',
    padding:       3,
    borderRadius:  12,
    borderWidth:   StyleSheet.hairlineWidth,
    gap:           3,
  },
  unitBtn: {
    paddingHorizontal:14,
    paddingVertical:  7,
    borderRadius:     9,
  },
  unitText: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },

  stripe: {
    height:              3,
    borderTopLeftRadius: 24,
    borderTopRightRadius:24,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginBottom:  18,
  },
  labelPuck: {
    width:          24, height: 24, borderRadius: 8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           6,
    marginBottom:  4,
  },
  bigInput: {
    fontSize:      64,
    fontWeight:    '800',
    letterSpacing: -3,
    padding:       0,
    minWidth:      140,
  },
  bigUnit: {
    fontSize:      22,
    fontWeight:    '700',
    letterSpacing: 0.4,
    paddingBottom: 6,
  },
  divider: {
    height:        StyleSheet.hairlineWidth,
    marginVertical:18,
  },
  deltaPill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingHorizontal:12,
    paddingVertical:  9,
    borderRadius:     10,
    alignSelf:        'flex-start',
  },
  deltaText: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: -0.1,
  },
  prevText: {
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.1,
    marginLeft:    2,
  },

  sectionLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.4,
    marginBottom:  12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  stepGroup: {
    flex:          1,
    flexDirection: 'row',
    gap:           6,
  },
  stepSep: {
    width:  StyleSheet.hairlineWidth,
    height: 36,
  },
  stepBtn: {
    flex:           1,
    paddingVertical: 13,
    borderRadius:    12,
    borderWidth:     StyleSheet.hairlineWidth,
    alignItems:      'center',
  },
  stepText: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },

});
