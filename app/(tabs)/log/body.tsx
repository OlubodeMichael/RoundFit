import { useState } from 'react';
import type { ComponentProps } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  AnimatedCard,
  DotMeter,
  FieldLabel,
  MiniLabel,
  NotesField,
  PrimaryButton,
  ScreenHeader,
  TextField,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import { SelectCellGrid } from '@/components/log/SelectCellGrid';
import { useToast } from '@/components/ui/Toast';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ── Soreness regions ───────────────────────────────────────────────────────
type Region =
  | 'neck'  | 'shoulders' | 'chest' | 'upper_back' | 'lower_back'
  | 'arms'  | 'core'      | 'glutes'| 'quads'      | 'hamstrings'
  | 'calves'| 'knees'     | 'hips'  | 'feet';

const REGIONS: { id: Region; label: string; icon: IoniconName }[] = [
  { id: 'neck',        label: 'Neck',        icon: 'person-outline'      },
  { id: 'shoulders',   label: 'Shoulders',   icon: 'person-outline'      },
  { id: 'chest',       label: 'Chest',       icon: 'fitness-outline'     },
  { id: 'upper_back',  label: 'Upper back',  icon: 'body-outline'        },
  { id: 'lower_back',  label: 'Lower back',  icon: 'body-outline'        },
  { id: 'arms',        label: 'Arms',        icon: 'barbell-outline'     },
  { id: 'core',        label: 'Core',        icon: 'ellipse-outline'     },
  { id: 'glutes',      label: 'Glutes',      icon: 'body-outline'        },
  { id: 'quads',       label: 'Quads',       icon: 'walk-outline'        },
  { id: 'hamstrings',  label: 'Hamstrings',  icon: 'walk-outline'        },
  { id: 'calves',      label: 'Calves',      icon: 'walk-outline'        },
  { id: 'knees',       label: 'Knees',       icon: 'ellipse-outline'     },
  { id: 'hips',        label: 'Hips',        icon: 'body-outline'        },
  { id: 'feet',        label: 'Feet',        icon: 'footsteps-outline'   },
];

// ── Soreness level ─────────────────────────────────────────────────────────
type Level = 'none' | 'mild' | 'moderate' | 'severe';

const LEVELS: { id: Level; label: string; dots: number }[] = [
  { id: 'none',     label: 'None',     dots: 0 },
  { id: 'mild',     label: 'Mild',     dots: 1 },
  { id: 'moderate', label: 'Moderate', dots: 2 },
  { id: 'severe',   label: 'Severe',   dots: 3 },
];

// ── Mood ───────────────────────────────────────────────────────────────────
type Mood = 'low' | 'meh' | 'good' | 'great';

const MOODS: { id: Mood; label: string; icon: IoniconName }[] = [
  { id: 'low',   label: 'Low',   icon: 'rainy-outline'      },
  { id: 'meh',   label: 'Meh',   icon: 'cloud-outline'      },
  { id: 'good',  label: 'Good',  icon: 'sunny-outline'      },
  { id: 'great', label: 'Great', icon: 'sparkles-outline'   },
];

export default function BodyMetricsScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const toast  = useToast();

  const [selected, setSelected] = useState<Set<Region>>(new Set());
  const [level,    setLevel]    = useState<Level>('none');
  const [mood,     setMood]     = useState<Mood>('good');
  const [energy,   setEnergy]   = useState(7);
  const [waist,    setWaist]    = useState('');
  const [hip,      setHip]      = useState('');
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const toggleRegion = (r: Region) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r); else next.add(r);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    const summary = selected.size === 0 && level === 'none'
      ? `Feeling ${mood} · Energy ${energy}/10`
      : `${capital(level)} soreness in ${selected.size} ${selected.size === 1 ? 'area' : 'areas'}`;
    toast.success('Body metrics saved', summary);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader eyebrow="How you feel" title="Body metrics" accent={P.body} />

        {/* ── Mood ───────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <AnimatedCard delay={60}>
            <FieldLabel>Overall mood</FieldLabel>
            <SelectCellGrid
              value={mood}
              onChange={setMood}
              options={MOODS.map((m) => {
                const color = moodColor(P, m.id);
                return {
                  id:    m.id,
                  label: m.label,
                  color,
                  top:   (active) => (
                    <Ionicons name={m.icon} size={18} color={active ? '#fff' : color} />
                  ),
                };
              })}
            />
          </AnimatedCard>
        </View>

        {/* ── Energy ─────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={120}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Text style={[styles.fieldLbl, { color: P.textFaint }]}>ENERGY LEVEL</Text>
              <Text style={[styles.energyVal, { color: P.body }]}>
                {energy}<Text style={{ color: P.textFaint, fontSize: 12 }}>/10</Text>
              </Text>
            </View>
            <View style={styles.energyRow}>
              {Array.from({ length: 10 }).map((_, i) => {
                const n = i + 1;
                const active = n <= energy;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setEnergy(n)}
                    style={[
                      styles.energyDot,
                      {
                        backgroundColor: active ? P.body : P.sunken,
                        borderColor:     active ? P.body : P.cardEdge,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </AnimatedCard>
        </View>

        {/* ── Soreness level ─────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={180}>
            <FieldLabel>Soreness intensity</FieldLabel>
            <SelectCellGrid
              value={level}
              onChange={setLevel}
              options={LEVELS.map((l) => {
                const color = levelColor(P, l.id);
                return {
                  id:    l.id,
                  label: l.label,
                  color,
                  top:   (active) => (
                    <DotMeter total={3} active={l.dots} color={color} inverted={active} />
                  ),
                };
              })}
            />
          </AnimatedCard>
        </View>

        {/* ── Soreness regions ───────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={240}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={[styles.fieldLbl, { color: P.textFaint }]}>AREAS</Text>
              {selected.size > 0 && (
                <Pressable onPress={() => setSelected(new Set())} hitSlop={8}>
                  <Text style={{ color: P.textDim, fontSize: 11, fontWeight: '700' }}>
                    Clear
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={styles.regionWrap}>
              {REGIONS.map((r) => {
                const active = selected.has(r.id);
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => toggleRegion(r.id)}
                    style={({ pressed }) => [
                      styles.regionPill,
                      {
                        backgroundColor: active ? P.body : P.sunken,
                        borderColor:     active ? P.body : P.cardEdge,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    {active && (
                      <Ionicons name="checkmark" size={12} color="#fff" style={{ marginRight: 4 }} />
                    )}
                    <Text style={[
                      styles.regionText,
                      { color: active ? '#fff' : P.textDim },
                    ]}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </AnimatedCard>
        </View>

        {/* ── Measurements (optional) ────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={300}>
            <FieldLabel>Measurements (optional)</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
              <View style={{ flex: 1 }}>
                <MiniLabel>Waist</MiniLabel>
                <TextField
                  value={waist}
                  onChangeText={(t) => setWaist(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0.0"
                  keyboardType="decimal-pad"
                  unit="in"
                />
              </View>
              <View style={{ flex: 1 }}>
                <MiniLabel>Hip</MiniLabel>
                <TextField
                  value={hip}
                  onChangeText={(t) => setHip(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0.0"
                  keyboardType="decimal-pad"
                  unit="in"
                />
              </View>
            </View>
          </AnimatedCard>
        </View>

        {/* ── Notes ──────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={360}>
            <FieldLabel>Notes</FieldLabel>
            <NotesField
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything worth remembering today?"
            />
          </AnimatedCard>
        </View>

        {/* ── CTA ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <PrimaryButton
            label="Save body log"
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            accent={P.body}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function moodColor(P: ReturnType<typeof usePalette>, m: Mood): string {
  if (m === 'great') return P.protein;
  if (m === 'good')  return P.body;
  if (m === 'meh')   return P.carbs;
  return P.danger;
}

function levelColor(P: ReturnType<typeof usePalette>, l: Level): string {
  if (l === 'none')     return P.protein;
  if (l === 'mild')     return P.carbs;
  if (l === 'moderate') return P.calories;
  return P.danger;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  fieldLbl: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },

  energyVal: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.4,
  },
  energyRow: {
    flexDirection: 'row',
    gap:           5,
    marginTop:     14,
  },
  energyDot: {
    flex:          1,
    height:        18,
    borderRadius:  5,
    borderWidth:   StyleSheet.hairlineWidth,
  },

  regionWrap: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  regionPill: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal:12,
    paddingVertical:  8,
    borderRadius:     999,
    borderWidth:      StyleSheet.hairlineWidth,
  },
  regionText: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 0.1,
  },
});
