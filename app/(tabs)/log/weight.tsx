import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  AnimatedCard,
  FieldLabel,
  PrimaryButton,
  ScreenHeader,
  Tip,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import { useToast } from '@/components/ui/Toast';

type Unit = 'lb' | 'kg';

// Mocked previous reading — replace with real data from the profile/weight
// context once wired.
const LAST_READING = { value: 168.8, unit: 'lb' as Unit };

export default function WeightLogScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const toast  = useToast();

  const [unit, setUnit]     = useState<Unit>(LAST_READING.unit);
  const [value, setValue]   = useState(LAST_READING.value.toFixed(1));
  const [saving, setSaving] = useState(false);

  const numeric = useMemo(() => parseFloat(value), [value]);
  const previous = useMemo(() => convert(LAST_READING.value, LAST_READING.unit, unit), [unit]);
  const delta    = useMemo(() => {
    if (!Number.isFinite(numeric)) return null;
    return numeric - previous;
  }, [numeric, previous]);

  const handleSave = async () => {
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast.warning('Invalid weight', 'Enter a positive number.');
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    toast.success('Weight logged', `${numeric.toFixed(1)} ${unit}`);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader eyebrow="Today's reading" title="Weight" accent={P.weight} />

        {/* ── Unit toggle ──────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <View style={[styles.segment, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
            {(['lb', 'kg'] as Unit[]).map((u) => {
              const active = u === unit;
              return (
                <Pressable
                  key={u}
                  onPress={() => {
                    if (active) return;
                    setUnit(u);
                    const parsed = parseFloat(value);
                    if (Number.isFinite(parsed)) {
                      setValue(convert(parsed, unit, u).toFixed(1));
                    }
                  }}
                  style={[
                    styles.segmentBtn,
                    active && { backgroundColor: P.weight },
                  ]}
                >
                  <Text style={[
                    styles.segmentText,
                    { color: active ? '#fff' : P.textDim },
                  ]}>
                    {u.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Hero input ──────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={60} padding={24}>
            <View style={{ alignItems: 'center' }}>
              <View style={[styles.scaleIcon, { backgroundColor: P.weightSoft }]}>
                <Ionicons name="scale" size={20} color={P.weight} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 14 }}>
                <TextInput
                  value={value}
                  onChangeText={(t) => setValue(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                  keyboardType="decimal-pad"
                  selectionColor={P.weight}
                  style={[styles.bigInput, { color: P.text }]}
                  maxLength={6}
                />
                <Text style={[styles.bigUnit, { color: P.textDim }]}>
                  {' '}{unit}
                </Text>
              </View>

              {delta !== null && (
                <View style={[
                  styles.deltaPill,
                  { backgroundColor: deltaColor(P, delta) + '22' },
                ]}>
                  <Ionicons
                    name={delta === 0 ? 'remove' : delta < 0 ? 'arrow-down' : 'arrow-up'}
                    size={12}
                    color={deltaColor(P, delta)}
                  />
                  <Text style={[styles.deltaText, { color: deltaColor(P, delta) }]}>
                    {Math.abs(delta).toFixed(1)} {unit} vs last
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <View style={[styles.dot, { backgroundColor: P.hair }]} />
                <Text style={[styles.prevLabel, { color: P.textFaint }]}>
                  Last: {previous.toFixed(1)} {unit}
                </Text>
              </View>
            </View>
          </AnimatedCard>
        </View>

        {/* ── Quick nudges ─────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={120}>
            <FieldLabel>Quick adjust</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
              {[-1, -0.1, 0.1, 1].map((step) => (
                <Pressable
                  key={step}
                  onPress={() => {
                    const current = parseFloat(value);
                    if (!Number.isFinite(current)) return;
                    const next = Math.max(0, current + step);
                    setValue(next.toFixed(1));
                  }}
                  style={({ pressed }) => [
                    styles.stepBtn,
                    { backgroundColor: P.sunken, borderColor: P.cardEdge },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.stepText, { color: P.text }]}>
                    {step > 0 ? `+${step}` : step}
                  </Text>
                </Pressable>
              ))}
            </View>
          </AnimatedCard>
        </View>

        {/* ── Tip ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={180} padding={14}>
            <Tip icon="information-circle" tint={P.protein}>
              Weigh yourself at the same time daily — ideally morning, after restroom, before food or water.
            </Tip>
          </AnimatedCard>
        </View>

        {/* ── CTA ──────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <PrimaryButton
            label="Log weight"
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            accent={P.weight}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  if (from === 'lb' && to === 'kg') return value / 2.20462;
  return value * 2.20462;
}

function deltaColor(P: ReturnType<typeof usePalette>, d: number): string {
  if (d === 0) return P.textDim;
  return d < 0 ? P.protein : P.carbs;
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    padding:       4,
    borderRadius:  14,
    borderWidth:   StyleSheet.hairlineWidth,
    alignSelf:     'flex-start',
    gap:           4,
  },
  segmentBtn: {
    paddingHorizontal:18,
    paddingVertical:  8,
    borderRadius:     10,
  },
  segmentText: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },

  scaleIcon: {
    width:          56, height: 56, borderRadius: 18,
    alignItems:     'center',
    justifyContent: 'center',
  },
  bigInput: {
    fontSize:      56,
    fontWeight:    '800',
    letterSpacing: -2.4,
    minWidth:      140,
    textAlign:     'center',
    padding:       0,
  },
  bigUnit: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: 0.5,
  },
  deltaPill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
    paddingHorizontal:10,
    paddingVertical:  5,
    borderRadius:     999,
    marginTop:        14,
  },
  deltaText: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 0.2,
  },
  dot: {
    width: 4, height: 4, borderRadius: 2,
  },
  prevLabel: {
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 0.2,
  },

  stepBtn: {
    flex:          1,
    paddingVertical: 12,
    borderRadius:  12,
    borderWidth:   StyleSheet.hairlineWidth,
    alignItems:    'center',
  },
  stepText: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
});
