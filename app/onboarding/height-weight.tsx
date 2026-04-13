import { ProgressBar } from '@/components/onboarding/progress-bar';
import { WheelColumn } from '@/components/onboarding/wheel-column';
import { useTheme } from '@/hooks/use-theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, StyleSheet, Switch, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Constants ──────────────────────────────────────────────────────────────
const FEET_OPTIONS = [3, 4, 5, 6, 7, 8] as const;
const CM_MIN = 100, CM_MAX = 250;
const KG_MIN = 30,  KG_MAX = 300;
const LB_MIN = 66,  LB_MAX = 661;

// ── Conversion helpers ─────────────────────────────────────────────────────
const totalInFromCm  = (cm: number)      => Math.max(39, Math.min(98, Math.round(cm / 2.54)));
const cmFromTotalIn  = (totalIn: number) => Math.round(totalIn * 2.54);
const kgToLb         = (kg: number)      => Math.round(kg * 2.20462);
const lbToKg         = (lb: number)      => Math.round(lb / 2.20462);

function inchRangeForFoot(ft: number) {
  return { lo: Math.max(0, 39 - ft * 12), hi: Math.min(11, 98 - ft * 12) };
}

function decomposeHeight(cm: number) {
  const totalIn = totalInFromCm(cm);
  let ft   = Math.max(FEET_OPTIONS[0], Math.min(FEET_OPTIONS[FEET_OPTIONS.length - 1], Math.floor(totalIn / 12)));
  const r  = inchRangeForFoot(ft);
  const inch = Math.min(r.hi, Math.max(r.lo, totalIn - ft * 12));
  return { ft, inch };
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function HeightWeightScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name: string; age: string; sex: string }>();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const [heightCm,   setHeightCm]   = useState(170);
  const [weightKg,   setWeightKg]   = useState(70);
  const [unitSystem, setUnitSystem] = useState<'imperial' | 'metric'>('imperial');

  const bg  = isDark ? '#0F0F0F' : '#FAFAF8';
  const hi  = isDark ? '#F5F5F5' : '#111111';
  const mid = isDark ? '#666'    : '#999';

  // ── Entrance animation ─────────────────────────────────────────────────
  const fade   = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 440, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setUnit = useCallback((sys: 'imperial' | 'metric') => {
    setUnitSystem(sys);
  }, []);

  // ── Picker data ────────────────────────────────────────────────────────
  const { ft, inch } = useMemo(() => decomposeHeight(heightCm), [heightCm]);
  const inchRange    = useMemo(() => inchRangeForFoot(ft), [ft]);

  const feetLabels = useMemo(() => FEET_OPTIONS.map(f => `${f} ft`), []);
  const inchLabels = useMemo(() => {
    const arr: string[] = [];
    for (let i = inchRange.lo; i <= inchRange.hi; i++) arr.push(`${i} in`);
    return arr;
  }, [inchRange]);
  const cmLabels = useMemo(() => { const a: string[] = []; for (let c = CM_MIN; c <= CM_MAX; c++) a.push(`${c} cm`); return a; }, []);
  const kgLabels = useMemo(() => { const a: string[] = []; for (let k = KG_MIN; k <= KG_MAX; k++) a.push(`${k} kg`); return a; }, []);
  const lbLabels = useMemo(() => { const a: string[] = []; for (let l = LB_MIN; l <= LB_MAX; l++) a.push(`${l} lb`); return a; }, []);

  const feetIndex = FEET_OPTIONS.findIndex(x => x === ft);
  const inchIndex = inch - inchRange.lo;
  const cmIndex   = heightCm - CM_MIN;
  const kgIndex   = weightKg - KG_MIN;
  const lbIndex   = Math.max(0, Math.min(LB_MAX - LB_MIN, kgToLb(weightKg) - LB_MIN));

  // ── Change handlers ────────────────────────────────────────────────────
  const onFeetIndex = useCallback((idx: number) => {
    const newFt = FEET_OPTIONS[idx];
    const oldIn = totalInFromCm(heightCm) % 12;
    const r     = inchRangeForFoot(newFt);
    setHeightCm(cmFromTotalIn(newFt * 12 + Math.min(r.hi, Math.max(r.lo, oldIn))));
  }, [heightCm]);

  const onInchIndex = useCallback((idx: number) => {
    const r = inchRangeForFoot(ft);
    setHeightCm(cmFromTotalIn(ft * 12 + r.lo + idx));
  }, [ft]);

  const onCmIndex = useCallback((idx: number) => setHeightCm(CM_MIN + idx), []);
  const onKgIndex = useCallback((idx: number) => setWeightKg(KG_MIN + idx), []);
  const onLbIndex = useCallback((idx: number) => setWeightKg(lbToKg(LB_MIN + idx)), []);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
      <View style={s.progress}>
        <ProgressBar step={5} total={9} onBack={() => router.back()} isDark={isDark} />
      </View>

      <Animated.View style={[s.hero, { opacity: fade, transform: [{ translateY: slideY }] }]}>
        <Text style={[s.headline, { color: hi }]}>Height &{'\n'}weight.</Text>
      </Animated.View>

      {/* ── Unit toggle: Imperial ⬤ Metric ─────────────────────────────── */}
      <View style={s.toggleRow}>
        <TouchableOpacity onPress={() => setUnit('imperial')} activeOpacity={0.7}>
          <Text style={[
            s.toggleLabel,
            {
              color:      unitSystem === 'imperial' ? hi : mid,
              fontWeight: unitSystem === 'imperial' ? '700' : '400',
            },
          ]}>
            Imperial
          </Text>
        </TouchableOpacity>

        <Switch
          value={unitSystem === 'metric'}
          onValueChange={v => setUnit(v ? 'metric' : 'imperial')}
          trackColor={{
            false: isDark ? '#2C2C2C' : '#DDDAD4',
            true:  '#F97316',
          }}
          thumbColor='#FFFFFF'
          ios_backgroundColor={isDark ? '#2C2C2C' : '#DDDAD4'}
          style={s.switch}
        />

        <TouchableOpacity onPress={() => setUnit('metric')} activeOpacity={0.7}>
          <Text style={[
            s.toggleLabel,
            {
              color:      unitSystem === 'metric' ? hi : mid,
              fontWeight: unitSystem === 'metric' ? '700' : '400',
            },
          ]}>
            Metric
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Open picker layout ──────────────────────────────────────────── */}
      <View style={s.pickerArea}>
        {unitSystem === 'imperial' ? (
          <View style={s.pickerRow}>
            {/* Height block: ft + in */}
            <View style={s.heightBlock}>
              <Text style={[s.colHeader, { color: hi }]}>Height</Text>
              <View style={s.imperialCols}>
                <WheelColumn
                  key="ft"
                  labels={feetLabels}
                  selectedIndex={feetIndex >= 0 ? feetIndex : 0}
                  onChange={onFeetIndex}
                  isDark={isDark}
                />
                <WheelColumn
                  key={`in-${ft}`}
                  labels={inchLabels}
                  selectedIndex={Math.max(0, Math.min(inchLabels.length - 1, inchIndex))}
                  onChange={onInchIndex}
                  isDark={isDark}
                />
              </View>
            </View>

            {/* Weight block: lb */}
            <View style={s.weightBlock}>
              <Text style={[s.colHeader, { color: hi }]}>Weight</Text>
              <WheelColumn
                key="lb"
                labels={lbLabels}
                selectedIndex={lbIndex}
                onChange={onLbIndex}
                isDark={isDark}
              />
            </View>
          </View>
        ) : (
          <View style={s.pickerRow}>
            {/* Height: cm */}
            <View style={s.metricHalf}>
              <Text style={[s.colHeader, { color: hi }]}>Height</Text>
              <WheelColumn
                key="cm"
                labels={cmLabels}
                selectedIndex={cmIndex}
                onChange={onCmIndex}
                isDark={isDark}
              />
            </View>

            {/* Weight: kg */}
            <View style={s.metricHalf}>
              <Text style={[s.colHeader, { color: hi }]}>Weight</Text>
              <WheelColumn
                key="kg"
                labels={kgLabels}
                selectedIndex={kgIndex}
                onChange={onKgIndex}
                isDark={isDark}
              />
            </View>
          </View>
        )}
      </View>

      <View style={{ flex: 1, minHeight: 12 }} />

      <TouchableOpacity
        style={s.cta}
        activeOpacity={0.88}
        onPress={() => router.push({
          pathname: '/onboarding/goal',
          params: { ...params, height: String(heightCm), weight: String(weightKg) },
        })}
      >
        <Text style={s.ctaText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 24 },
  progress: { marginBottom: 4 },

  hero:     { marginBottom: 28 },
  headline: { fontSize: 40, fontWeight: '900', letterSpacing: -2, lineHeight: 44 },

  // ── Unit toggle ───────────────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  toggleLabel: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  switch: {
    marginHorizontal: 14,
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },

  // ── Open picker area ──────────────────────────────────────────────────
  pickerArea: {
    flex: 1,
    minHeight: 300,
  },

  pickerRow:    { flex: 1, flexDirection: 'row' },
  heightBlock:  { flex: 1.15 },
  weightBlock:  { flex: 0.85 },
  imperialCols: { flex: 1, flexDirection: 'row' },
  metricHalf:   { flex: 1 },

  colHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 6,
  },

  // ── CTA ───────────────────────────────────────────────────────────────
  cta: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
});
