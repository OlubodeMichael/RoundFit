import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { normaliseGoal, type UserProfile } from '@/context/auth-context';
import {
  convertBodyFieldsForUnitChange,
  formatHeightCmField,
  formatHeightImperialFields,
  formatWeightKgField,
  heightCmToStored,
  LB_PER_KG,
  parseWeightFieldToKg,
} from '@/utils/body-units';

const O = '#F97316';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function stepMetricCm(raw: string, dir: 1 | -1): string {
  let n = parseFloat(raw);
  if (Number.isNaN(n) || raw.trim() === '') {
    if (dir < 0) return '';
    n = 170;
  } else {
    n = clamp(n + dir, 50, 260);
  }
  return formatHeightCmField(n);
}

function stepMetricKg(raw: string, dir: 1 | -1): string {
  let n = parseFloat(raw);
  if (Number.isNaN(n) || raw.trim() === '') {
    if (dir < 0) return '';
    n = 65;
  } else {
    const next = Math.round((n + dir * 0.1) * 10) / 10;
    n = clamp(next, 25, 250);
  }
  return formatWeightKgField(n, 'metric');
}

function stepImperialLb(raw: string, dir: 1 | -1): string {
  const kg = parseWeightFieldToKg(raw, 'imperial');
  if (kg === undefined || raw.trim() === '') {
    if (dir < 0) return '';
    return formatWeightKgField(150 / LB_PER_KG, 'imperial');
  }
  const next = clamp(kg + dir / LB_PER_KG, 25, 250);
  return formatWeightKgField(next, 'imperial');
}

/** Total inches; min ~3′, max ~8′. */
function stepImperialHeightTotal(feetStr: string, inchesStr: string, inchDelta: number): { feet: string; inches: string } {
  const ft = parseInt(feetStr, 10);
  const inch = parseInt(inchesStr, 10);
  const f = Number.isNaN(ft) ? 0 : ft;
  const i = Number.isNaN(inch) ? 0 : inch;
  let total = f * 12 + i;
  const empty = feetStr.trim() === '' && inchesStr.trim() === '';

  if (empty) {
    if (inchDelta <= 0) return { feet: '', inches: '' };
    total = 67;
  } else {
    total = clamp(total + inchDelta, 36, 96);
  }
  return { feet: String(Math.floor(total / 12)), inches: String(total % 12) };
}

/** Large "scale card" with circular −/+ nudge buttons and a centred editable value. */
function MeasureCard({
  label,
  children,
  onIncrement,
  onDecrement,
  surface,
  lo,
  isDark,
}: {
  label:       string;
  children:    React.ReactNode;
  onIncrement: () => void;
  onDecrement: () => void;
  surface:     string;
  lo:          string;
  isDark:      boolean;
}) {
  const btnBg = isDark ? '#1E1E1E' : '#F0EFEc';
  return (
    <View style={[mc.card, { backgroundColor: surface, borderColor: lo }]}>
      <Text style={[mc.label, { color: isDark ? '#555' : '#BBBAB6' }]}>{label}</Text>
      <View style={mc.row}>
        <TouchableOpacity
          style={[mc.btn, { backgroundColor: btnBg, borderColor: lo }]}
          onPress={onDecrement}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={mc.btnGlyph}>−</Text>
        </TouchableOpacity>
        <View style={mc.center}>{children}</View>
        <TouchableOpacity
          style={[mc.btn, { backgroundColor: btnBg, borderColor: lo }]}
          onPress={onIncrement}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={mc.btnGlyph}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

type GoalValue     = UserProfile['goal'];
type ActivityValue = UserProfile['activityLevel'];

const GOAL_OPTIONS: { label: string; value: GoalValue }[] = [
  { label: 'Lose weight',   value: 'lose_weight'  },
  { label: 'Build muscle',  value: 'build_muscle' },
  { label: 'Boost energy',  value: 'boost_energy' },
  { label: 'Maintain',      value: 'maintain'     },
];

const ACTIVITY_OPTIONS: { label: string; sub: string; value: ActivityValue }[] = [
  { label: 'Sedentary',          sub: 'Little or no exercise',   value: 'sedentary'          },
  { label: 'Lightly active',     sub: '1–3 days / week',         value: 'lightly_active'     },
  { label: 'Moderately active',  sub: '3–5 days / week',         value: 'moderately_active'  },
  { label: 'Very active',        sub: '6–7 days / week',         value: 'very_active'        },
];

export default function EditProfileScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { profile, updateProfile } = useProfile();

  const [saving, setSaving] = useState(false);

  const [name,          setName]          = useState(profile?.name           ?? '');
  const [age,           setAge]           = useState(String(profile?.age     ?? ''));
  const [sex,           setSex]           = useState<UserProfile['sex']>(profile?.sex ?? 'male');
  const initialUnit = profile?.unit ?? 'metric';
  const initialImperial = initialUnit === 'imperial' ? formatHeightImperialFields(profile?.heightCm) : { feet: '', inches: '' };
  const [unit, setUnit] = useState<UserProfile['unit']>(initialUnit);
  const [heightCm, setHeightCm] = useState(() =>
    initialUnit === 'metric' ? formatHeightCmField(profile?.heightCm) : '',
  );
  const [heightFeet, setHeightFeet] = useState(initialImperial.feet);
  const [heightInches, setHeightInches] = useState(initialImperial.inches);
  const [weightKg, setWeightKg] = useState(() =>
    formatWeightKgField(profile?.weightKg, initialUnit),
  );
  const [activityLevel, setActivityLevel] = useState<ActivityValue>(() => {
    const a = profile?.activityLevel ?? 'lightly_active';
    if (a === 'sedentary' || a === 'lightly_active' || a === 'moderately_active' || a === 'very_active') return a;
    return 'lightly_active';
  });
  const [goal, setGoal] = useState<GoalValue>(() =>
    normaliseGoal(profile?.goal ?? 'maintain'),
  );

  const bg      = isDark ? '#0A0A0A' : '#F7F7F5';
  const surface = isDark ? '#141414' : '#FFFFFF';
  const hi      = isDark ? '#F0F0F0' : '#111111';
  const mid     = isDark ? '#666'    : '#999';
  const lo      = isDark ? '#232323' : '#EBEBEB';

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        name:          name.trim()  || undefined,
        age:           age          ? Number(age)      : undefined,
        sex,
        heightCm:      heightCmToStored(unit, heightCm, heightFeet, heightInches),
        weightKg:      parseWeightFieldToKg(weightKg, unit),
        activityLevel,
        goal,
        unit,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.root, { backgroundColor: bg }]}>

        {/* ── Header ── */}
        <View style={[s.header, { paddingTop: insets.top + 14, borderBottomColor: lo }]}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[s.headerAction, { color: mid }]}>Cancel</Text>
          </TouchableOpacity>

          <Text style={[s.headerTitle, { color: hi }]}>Edit Profile</Text>

          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            {saving
              ? <ActivityIndicator size="small" color={O} />
              : <Text style={[s.headerAction, { color: O, fontFamily: 'Syne_700Bold' }]}>Save</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Personal ── */}
          <SectionLabel label="Personal" color={mid} />
          <View style={[s.group, { backgroundColor: surface, borderColor: lo }]}>
            <Row label="Name">
              <TextInput
                style={[s.input, { color: hi }]}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={lo}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </Row>
            <Sep color={lo} />
            <Row label="Age">
              <TextInput
                style={[s.input, { color: hi }]}
                value={age}
                onChangeText={setAge}
                placeholder="—"
                placeholderTextColor={lo}
                keyboardType="number-pad"
              />
            </Row>
            <Sep color={lo} />
            <Row label="Sex">
              <View style={s.segWrap}>
                {(['male', 'female'] as const).map(v => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setSex(v)}
                    activeOpacity={0.75}
                    style={[s.seg, sex === v && { backgroundColor: O }]}
                  >
                    <Text style={[s.segText, { color: sex === v ? '#FFF' : mid }]}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Row>
          </View>

          {/* ── Body ── */}
          <SectionLabel label="Body" color={mid} />

          {/* Units segmented control */}
          <View style={[s.unitsSeg, { backgroundColor: isDark ? '#1A1A1A' : '#ECEAE6' }]}>
            {([
              { label: 'Metric',   sub: 'kg · cm',       value: 'metric'   },
              { label: 'Imperial', sub: 'lbs · ft · in',  value: 'imperial' },
            ] as const).map(opt => {
              const active = unit === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    if (active) return;
                    const conv = convertBodyFieldsForUnitChange(unit, opt.value, {
                      heightCm, heightFeet, heightInches, weight: weightKg,
                    });
                    setHeightCm(conv.heightCm);
                    setHeightFeet(conv.heightFeet);
                    setHeightInches(conv.heightInches);
                    setWeightKg(conv.weight);
                    setUnit(opt.value);
                  }}
                  activeOpacity={0.75}
                  style={[
                    s.unitsPill,
                    active && { backgroundColor: surface },
                    active && { shadowColor: '#000', shadowOpacity: isDark ? 0.4 : 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
                  ]}
                >
                  <Text style={[s.unitsPillLabel, { color: active ? (isDark ? '#F0F0F0' : '#111') : mid }]}>
                    {opt.label}
                  </Text>
                  <Text style={[s.unitsPillSub, { color: active ? O : mid }]}>
                    {opt.sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Height card */}
          <MeasureCard
            label="HEIGHT"
            surface={surface}
            lo={lo}
            isDark={isDark}
            onIncrement={() => {
              if (unit === 'imperial') {
                const r = stepImperialHeightTotal(heightFeet, heightInches, 1);
                setHeightFeet(r.feet); setHeightInches(r.inches);
              } else {
                setHeightCm(stepMetricCm(heightCm, 1));
              }
            }}
            onDecrement={() => {
              if (unit === 'imperial') {
                const r = stepImperialHeightTotal(heightFeet, heightInches, -1);
                setHeightFeet(r.feet); setHeightInches(r.inches);
              } else {
                setHeightCm(stepMetricCm(heightCm, -1));
              }
            }}
          >
            {unit === 'imperial' ? (
              <View style={mc.dualField}>
                <View style={mc.fieldGroup}>
                  <TextInput
                    style={[mc.value, { color: hi }]}
                    value={heightFeet}
                    onChangeText={setHeightFeet}
                    placeholder="—"
                    placeholderTextColor={lo}
                    keyboardType="number-pad"
                  />
                  <Text style={[mc.unit, { color: mid }]}>ft</Text>
                </View>
                <View style={[mc.fieldDivider, { backgroundColor: lo }]} />
                <View style={mc.fieldGroup}>
                  <TextInput
                    style={[mc.value, { color: hi }]}
                    value={heightInches}
                    onChangeText={setHeightInches}
                    placeholder="—"
                    placeholderTextColor={lo}
                    keyboardType="number-pad"
                  />
                  <Text style={[mc.unit, { color: mid }]}>in</Text>
                </View>
              </View>
            ) : (
              <View style={mc.fieldGroup}>
                <TextInput
                  style={[mc.value, { color: hi }]}
                  value={heightCm}
                  onChangeText={setHeightCm}
                  placeholder="—"
                  placeholderTextColor={lo}
                  keyboardType="decimal-pad"
                />
                <Text style={[mc.unit, { color: mid }]}>cm</Text>
              </View>
            )}
          </MeasureCard>

          {/* Weight card */}
          <MeasureCard
            label="WEIGHT"
            surface={surface}
            lo={lo}
            isDark={isDark}
            onIncrement={() => setWeightKg(unit === 'imperial' ? stepImperialLb(weightKg, 1)  : stepMetricKg(weightKg, 1))}
            onDecrement={() => setWeightKg(unit === 'imperial' ? stepImperialLb(weightKg, -1) : stepMetricKg(weightKg, -1))}
          >
            <View style={mc.fieldGroup}>
              <TextInput
                style={[mc.value, { color: hi }]}
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="—"
                placeholderTextColor={lo}
                keyboardType={unit === 'imperial' ? 'number-pad' : 'decimal-pad'}
              />
              <Text style={[mc.unit, { color: mid }]}>{unit === 'imperial' ? 'lbs' : 'kg'}</Text>
            </View>
          </MeasureCard>

          {/* ── Goal ── */}
          <SectionLabel label="Goal" color={mid} />
          <View style={[s.group, { backgroundColor: surface, borderColor: lo }]}>
            {GOAL_OPTIONS.map((opt, i) => (
              <View key={opt.value}>
                {i > 0 && <Sep color={lo} />}
                <TouchableOpacity
                  style={s.optRow}
                  onPress={() => setGoal(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.optLabel, { color: goal === opt.value ? O : hi }]}>
                    {opt.label}
                  </Text>
                  {goal === opt.value && (
                    <View style={[s.dot, { backgroundColor: O }]} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* ── Activity ── */}
          <SectionLabel label="Activity Level" color={mid} />
          <View style={[s.group, { backgroundColor: surface, borderColor: lo }]}>
            {ACTIVITY_OPTIONS.map((opt, i) => (
              <View key={opt.value}>
                {i > 0 && <Sep color={lo} />}
                <TouchableOpacity
                  style={s.optRow}
                  onPress={() => setActivityLevel(opt.value)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optLabel, { color: activityLevel === opt.value ? O : hi }]}>
                      {opt.label}
                    </Text>
                    <Text style={[s.optSub, { color: mid }]}>{opt.sub}</Text>
                  </View>
                  {activityLevel === opt.value && (
                    <View style={[s.dot, { backgroundColor: O }]} />
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionLabel({ label, color }: { label: string; color: string }) {
  return <Text style={[s.sectionLabel, { color }]}>{label}</Text>;
}

function Sep({ color }: { color: string }) {
  return <View style={[s.sep, { backgroundColor: color }]} />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

// ── MeasureCard styles ──────────────────────────────────────────────────────

const mc = StyleSheet.create({
  card: {
    borderRadius:      16,
    borderWidth:       1,
    paddingHorizontal: 20,
    paddingTop:        18,
    paddingBottom:     22,
  },
  label: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
    marginBottom:  14,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  btn: {
    width:          56,
    height:         56,
    borderRadius:   28,
    borderWidth:    1,
    justifyContent: 'center',
    alignItems:     'center',
  },
  btnGlyph: {
    fontSize:   26,
    fontWeight: '300',
    color:      '#F97316',
    lineHeight: 30,
    includeFontPadding: false,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  fieldGroup: {
    alignItems: 'center',
    gap:         2,
  },
  value: {
    fontFamily: 'Syne_700Bold',
    fontSize:   44,
    lineHeight: 50,
    textAlign:  'center',
    minWidth:   90,
    includeFontPadding: false,
  },
  unit: {
    fontSize:   13,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  dualField: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  fieldDivider: {
    width:  1,
    height: 40,
    opacity: 0.5,
  },
});

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingBottom:     14,
    borderBottomWidth: 1,
  },
  headerTitle:  { fontFamily: 'Syne_700Bold', fontSize: 16, color: '#888' },
  headerAction: { fontSize: 15 },

  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 6 },

  sectionLabel: {
    fontSize:      12,
    fontWeight:    '600',
    letterSpacing: 0.3,
    marginTop:     20,
    marginBottom:  6,
    paddingHorizontal: 4,
  },

  group: {
    borderRadius: 14,
    borderWidth:  1,
    overflow:     'hidden',
  },

  sep: { height: 1, marginHorizontal: 16 },

  row: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap: 12,
  },
  rowLabel: {
    flex:       1,
    fontSize:   15,
    fontWeight: '500',
    color:      '#888',
  },
  input: {
    fontSize:   15,
    fontWeight: '500',
    textAlign:  'right',
    minWidth:   80,
  },

  unitsSeg: {
    flexDirection:  'row',
    borderRadius:   14,
    padding:         4,
    gap:             4,
  },
  unitsPill: {
    flex:            1,
    paddingVertical: 11,
    borderRadius:    10,
    alignItems:      'center',
    gap:              2,
  },
  unitsPillLabel: {
    fontSize:   14,
    fontWeight: '600',
  },
  unitsPillSub: {
    fontSize:   11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  segWrap: {
    flexDirection: 'row',
    gap:           4,
  },
  seg: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      20,
  },
  segText: {
    fontSize:   13,
    fontWeight: '600',
  },

  optRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 16,
    paddingVertical:   15,
    gap: 12,
  },
  optLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  optSub:   { fontSize: 12, marginTop: 1 },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
});
