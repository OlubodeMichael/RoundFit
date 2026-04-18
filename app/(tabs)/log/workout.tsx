import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
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
  DotMeter,
  FieldLabel,
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

type WorkoutType = 'strength' | 'cardio' | 'hiit' | 'yoga' | 'other';
type Intensity   = 'low' | 'moderate' | 'high' | 'max';

const TYPES: { id: WorkoutType; label: string; icon: IoniconName }[] = [
  { id: 'strength', label: 'Strength', icon: 'barbell-outline'   },
  { id: 'cardio',   label: 'Cardio',   icon: 'heart-outline'     },
  { id: 'hiit',     label: 'HIIT',     icon: 'flash-outline'     },
  { id: 'yoga',     label: 'Yoga',     icon: 'leaf-outline'      },
  { id: 'other',    label: 'Other',    icon: 'apps-outline'      },
];

const INTENSITY: { id: Intensity; label: string; dots: number }[] = [
  { id: 'low',      label: 'Low',      dots: 1 },
  { id: 'moderate', label: 'Moderate', dots: 2 },
  { id: 'high',     label: 'High',     dots: 3 },
  { id: 'max',      label: 'Max',      dots: 4 },
];

type SetRow = { id: string; reps: string; weight: string };

export default function WorkoutLogScreen() {
  const P      = usePalette();
  const router = useRouter();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const toast  = useToast();

  const [type,      setType]      = useState<WorkoutType>('strength');
  const [name,      setName]      = useState('');
  const [duration,  setDuration]  = useState('45');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [notes,     setNotes]     = useState('');
  const [sets,      setSets]      = useState<SetRow[]>([
    { id: 's1', reps: '', weight: '' },
  ]);
  const [saving,    setSaving]    = useState(false);

  const isStrength = type === 'strength';
  const totalVolume = useMemo(() => {
    if (!isStrength) return 0;
    return sets.reduce((acc, s) => {
      const r = parseFloat(s.reps);
      const w = parseFloat(s.weight);
      if (Number.isFinite(r) && Number.isFinite(w)) return acc + r * w;
      return acc;
    }, 0);
  }, [sets, isStrength]);

  const addSet = () => {
    setSets((prev) => [...prev, { id: `s${Date.now()}`, reps: '', weight: '' }]);
  };

  const removeSet = (id: string) => {
    setSets((prev) => prev.length === 1 ? prev : prev.filter((s) => s.id !== id));
  };

  const updateSet = (id: string, patch: Partial<SetRow>) => {
    setSets((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  };

  const handleSave = async () => {
    if (!duration.trim()) {
      toast.warning('Missing duration', 'How long was this workout?');
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    toast.success('Workout logged', `${capital(type)} · ${duration} min`);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader eyebrow="Training" title="Workout" accent={P.workout} />

        {/* ── Type picker ─────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <AnimatedCard delay={60}>
            <FieldLabel>Type</FieldLabel>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {TYPES.map((t) => {
                const active = t.id === type;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setType(t.id)}
                    style={({ pressed }) => [
                      styles.typeCell,
                      {
                        backgroundColor: active ? P.workout : P.sunken,
                        borderColor:     active ? P.workout : P.cardEdge,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons name={t.icon} size={18} color={active ? '#fff' : P.workout} />
                    <Text style={[
                      styles.typeLabel,
                      { color: active ? '#fff' : P.text },
                    ]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </AnimatedCard>
        </View>

        {/* ── Name + Duration ─────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={120}>
            <FieldLabel>Session name</FieldLabel>
            <TextField
              value={name}
              onChangeText={setName}
              placeholder="Push day · Chest & triceps"
              autoCapitalize="sentences"
            />

            <View style={{ height: 14 }} />

            <FieldLabel>Duration</FieldLabel>
            <TextField
              value={duration}
              onChangeText={(t) => setDuration(t.replace(/[^0-9]/g, ''))}
              placeholder="45"
              keyboardType="number-pad"
              unit="min"
            />
          </AnimatedCard>
        </View>

        {/* ── Intensity ───────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={180}>
            <FieldLabel>Intensity</FieldLabel>
            <SelectCellGrid
              value={intensity}
              onChange={setIntensity}
              options={INTENSITY.map((i) => ({
                id:    i.id,
                label: i.label,
                color: P.workout,
                top:   (active) => (
                  <DotMeter total={4} active={i.dots} color={P.workout} inverted={active} />
                ),
              }))}
            />
          </AnimatedCard>
        </View>

        {/* ── Sets / Reps (strength only) ─────────────────── */}
        {isStrength && (
          <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
            <AnimatedCard delay={240}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <FieldLabel>Sets</FieldLabel>
                {totalVolume > 0 && (
                  <Text style={[styles.volume, { color: P.workout }]}>
                    {Math.round(totalVolume).toLocaleString()} lb volume
                  </Text>
                )}
              </View>

              <View style={[styles.setHead, { borderBottomColor: P.hair }]}>
                <Text style={[styles.setHeadText, { color: P.textFaint, width: 32 }]}>#</Text>
                <Text style={[styles.setHeadText, { color: P.textFaint, flex: 1 }]}>REPS</Text>
                <Text style={[styles.setHeadText, { color: P.textFaint, flex: 1 }]}>WEIGHT (LB)</Text>
                <View style={{ width: 30 }} />
              </View>

              {sets.map((s, idx) => (
                <View key={s.id} style={styles.setRow}>
                  <Text style={[styles.setIdx, { color: P.textDim }]}>
                    {idx + 1}
                  </Text>
                  <TextInput
                    value={s.reps}
                    onChangeText={(t) => updateSet(s.id, { reps: t.replace(/[^0-9]/g, '') })}
                    placeholder="12"
                    placeholderTextColor={P.textFaint}
                    keyboardType="number-pad"
                    style={[styles.setInput, { backgroundColor: P.sunken, borderColor: P.cardEdge, color: P.text }]}
                  />
                  <TextInput
                    value={s.weight}
                    onChangeText={(t) => updateSet(s.id, { weight: t.replace(/[^0-9.]/g, '') })}
                    placeholder="135"
                    placeholderTextColor={P.textFaint}
                    keyboardType="decimal-pad"
                    style={[styles.setInput, { backgroundColor: P.sunken, borderColor: P.cardEdge, color: P.text }]}
                  />
                  <Pressable
                    onPress={() => removeSet(s.id)}
                    hitSlop={8}
                    style={styles.setRemove}
                    disabled={sets.length === 1}
                  >
                    <Ionicons
                      name="close"
                      size={16}
                      color={sets.length === 1 ? P.textFaint : P.textDim}
                    />
                  </Pressable>
                </View>
              ))}

              <Pressable
                onPress={addSet}
                style={({ pressed }) => [
                  styles.addSet,
                  { borderColor: P.cardEdge },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Ionicons name="add" size={14} color={P.workout} />
                <Text style={[styles.addSetText, { color: P.workout }]}>Add set</Text>
              </Pressable>
            </AnimatedCard>
          </View>
        )}

        {/* ── Notes ───────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
          <AnimatedCard delay={300}>
            <FieldLabel>Notes</FieldLabel>
            <NotesField
              value={notes}
              onChangeText={setNotes}
              placeholder="PRs, form cues, how it felt…"
            />
          </AnimatedCard>
        </View>

        {/* ── CTA ─────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <PrimaryButton
            label="Log workout"
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            accent={P.workout}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  typeCell: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              8,
    paddingVertical:  10,
    paddingHorizontal:14,
    borderRadius:     14,
    borderWidth:      StyleSheet.hairlineWidth,
  },
  typeLabel: {
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },

  volume: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 0.1,
  },
  setHead: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingBottom:     8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:               10,
  },
  setHeadText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },
  setRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginTop:     10,
  },
  setIdx: {
    width:         32,
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
  setInput: {
    flex:             1,
    height:           42,
    borderWidth:      StyleSheet.hairlineWidth,
    borderRadius:     10,
    paddingHorizontal:12,
    fontSize:         14,
    fontWeight:       '700',
  },
  setRemove: {
    width:          30, height: 30, borderRadius: 10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  addSet: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              6,
    borderWidth:      StyleSheet.hairlineWidth,
    borderRadius:     12,
    borderStyle:      'dashed',
    paddingVertical:  12,
    marginTop:        12,
  },
  addSetText: {
    fontSize:      12,
    fontWeight:    '800',
    letterSpacing: -0.1,
  },
});
