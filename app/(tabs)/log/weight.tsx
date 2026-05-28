import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, {
  Path, Circle, Defs, LinearGradient, Stop,
  Text as SvgText, Line, G,
} from 'react-native-svg';

import { AnimatedCard, PrimaryButton, usePalette } from '@/lib/log-theme';
import { useToast } from '@/components/ui/Toast';
import { useWeight } from '@/hooks/use-weight';
import type { WeightEntry } from '@/context/weight-context';
import { useProfile } from '@/hooks/use-profile';
import { useUnits } from '@/hooks/use-units';
import { usePostHog } from 'posthog-react-native';

type Unit      = 'lb' | 'kg';
type TimeRange = 'W' | 'M' | 'Y';

const RANGE_MS: Record<TimeRange, number> = {
  W: 7   * 86_400_000,
  M: 30  * 86_400_000,
  Y: 365 * 86_400_000,
};
const DAY_LABELS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function convert(val: number, from: Unit, to: Unit): number {
  if (from === to) return val;
  return from === 'lb' ? val / 2.20462 : val * 2.20462;
}
function deltaColor(P: ReturnType<typeof usePalette>, d: number): string {
  if (d === 0) return P.textDim;
  return d < 0 ? P.protein : P.carbs;
}

// Returns 7 points for Mon–Sun of the current week.
// Days without an entry are filled with the most recent known weight.
function prepareWeekPoints(
  entries: WeightEntry[],
  unit: Unit,
): { w: number; isFill: boolean; label: string }[] | null {
  if (entries.length === 0) return null;
  const latestKg = entries[0].weight_kg;

  const today = new Date();
  const dow   = today.getDay();                     // 0 = Sun
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMon);
  weekStart.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const entry = entries.find((e) => e.logged_at.startsWith(key));
    return {
      w:      convert(entry?.weight_kg ?? latestKg, 'kg', unit),
      isFill: !entry,
      label:  DAY_LABELS[d.getDay()],
    };
  });
}

// ── Smooth bezier ─────────────────────────────────────────────────────────────
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], curr = pts[i];
    const cx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C${cx},${prev.y.toFixed(1)} ${cx},${curr.y.toFixed(1)} ${curr.x.toFixed(1)},${curr.y.toFixed(1)}`;
  }
  return d;
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function WeightChart({
  entries, unit, acc, chartWidth, range, palette,
}: {
  entries:    WeightEntry[];
  unit:       Unit;
  acc:        string;
  chartWidth: number;
  range:      TimeRange;
  palette:    ReturnType<typeof usePalette>;
}) {
  const W  = chartWidth;
  const H  = 188;
  const L  = 42;                                  // left padding for Y labels
  const PAD = { top: 12, bottom: 32, left: L, right: 6 };
  const PW  = W - PAD.left - PAD.right;
  const PH  = H - PAD.top - PAD.bottom;

  // ── Week view: 7 evenly-spaced points (Mon–Sun) ──────────────────────────
  const weekPts = useMemo(
    () => (range === 'W' ? prepareWeekPoints(entries, unit) : null),
    [range, entries, unit],
  );

  // ── Month / Year view: timestamp-based filtered entries ──────────────────
  const { startMs, rangeMs } = useMemo(() => {
    const now = Date.now();
    const ms  = RANGE_MS[range];
    return { startMs: now - ms, rangeMs: ms };
  }, [range]);

  const filteredMY = useMemo(() => {
    if (range === 'W') return [];
    return entries.filter((e) => new Date(e.logged_at).getTime() >= startMs).reverse();
  }, [range, entries, startMs]);

  // ── Unified point list ───────────────────────────────────────────────────
  const computed = useMemo(() => {
    // Collect raw (weight in user unit, isFill, x-fraction 0–1)
    let raw: { w: number; frac: number; isFill: boolean }[] = [];

    if (range === 'W') {
      if (!weekPts || weekPts.length < 2) return null;
      raw = weekPts.map((p, i) => ({ w: p.w, frac: i / 6, isFill: p.isFill }));
    } else {
      if (filteredMY.length < 2) return null;
      raw = filteredMY.map((e) => {
        const t    = new Date(e.logged_at).getTime();
        const frac = (t - startMs) / rangeMs;
        return { w: convert(e.weight_kg, 'kg', unit), frac, isFill: false };
      });
    }

    const weights   = raw.map((r) => r.w);
    const dataMin   = Math.min(...weights);
    // 10 ticks at step 1 — anchor at floor(dataMin), range spans tickStart..tickStart+9
    const tickStart = Math.floor(dataMin);
    const yMin      = tickStart - 0.5;        // small gap below first tick
    const yMax      = tickStart + 9.5;        // small gap above last tick

    const pts = raw.map((r) => ({
      x:      PAD.left + r.frac * PW,
      y:      PAD.top  + (1 - (r.w - yMin) / (yMax - yMin)) * PH,
      isFill: r.isFill,
    }));

    const yTicks: { y: number; value: number }[] = Array.from({ length: 10 }, (_, i) => {
      const v = tickStart + i;
      const y = PAD.top + (1 - (v - yMin) / (yMax - yMin)) * PH;
      return { y, value: v };
    });

    return { pts, yTicks, yMin, yMax };
  }, [range, weekPts, filteredMY, unit, startMs, rangeMs, PW, PH]);

  // ── X-axis labels ────────────────────────────────────────────────────────
  const xLabels = useMemo(() => {
    if (range === 'W' && weekPts) {
      return weekPts.map((p, i) => ({
        x:      PAD.left + (i / 6) * PW,
        label:  p.label,
        isLast: i === 6,
      }));
    }
    const count = range === 'M' ? 5 : 6;
    return Array.from({ length: count }, (_, i) => {
      const t = startMs + (i / (count - 1)) * rangeMs;
      const d = new Date(t);
      const label = range === 'M'
        ? `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`
        : MONTH_LABELS[d.getMonth()];
      return { x: PAD.left + (i / (count - 1)) * PW, label, isLast: i === count - 1 };
    });
  }, [range, weekPts, startMs, rangeMs, PW]);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!computed || W === 0) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Ionicons name="stats-chart-outline" size={28} color={palette.textFaint} />
        <Text style={{ color: palette.textFaint, fontSize: 12, fontWeight: '600' }}>
          {entries.length === 0
            ? 'Log your first weight to see a trend'
            : 'Not enough entries in this period'}
        </Text>
      </View>
    );
  }

  const { pts, yTicks } = computed;
  const linePath  = smooth(pts);
  const last       = pts[pts.length - 1];
  const floor      = (H - PAD.bottom).toFixed(1);
  const areaPath   = `${linePath} L${last.x.toFixed(1)},${floor} L${pts[0].x.toFixed(1)},${floor} Z`;

  return (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={acc} stopOpacity="0.20" />
          <Stop offset="1" stopColor={acc} stopOpacity="0"    />
        </LinearGradient>
      </Defs>

      {/* Y-axis grid lines + labels */}
      {yTicks.map((t, i) => (
        <G key={i}>
          <Line
            x1={PAD.left} y1={t.y}
            x2={W - PAD.right} y2={t.y}
            stroke={palette.hair} strokeWidth={1}
          />
          <SvgText
            x={PAD.left - 6}
            y={t.y + 4}
            fontSize={9}
            fontWeight="600"
            fill={palette.textFaint}
            textAnchor="end"
          >
            {String(t.value)}
          </SvgText>
        </G>
      ))}

      {/* Area + line */}
      <Path d={areaPath} fill="url(#wg)" />
      <Path
        d={linePath}
        stroke={acc} strokeWidth={2.5}
        fill="none" strokeLinecap="round" strokeLinejoin="round"
      />

      {/* Data dots — hollow for fills, solid for real entries */}
      {pts.map((p, i) => (
        p.isFill ? (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={palette.bg} stroke={acc} strokeWidth={1.5} opacity={0.5} />
        ) : (
          <Circle key={i} cx={p.x} cy={p.y}
            r={i === pts.length - 1 ? 4.5 : 3}
            fill={acc}
            opacity={i === pts.length - 1 ? 1 : 0.45}
          />
        )
      ))}

      {/* X-axis baseline */}
      <Line
        x1={PAD.left} y1={H - PAD.bottom}
        x2={W - PAD.right} y2={H - PAD.bottom}
        stroke={palette.hair} strokeWidth={1}
      />

      {/* X-axis labels */}
      {xLabels.map((lbl, i) => (
        <SvgText
          key={i}
          x={lbl.x}
          y={H - 10}
          fontSize={9}
          fontWeight="600"
          fill={palette.textFaint}
          textAnchor={i === 0 ? 'start' : lbl.isLast ? 'end' : 'middle'}
        >
          {lbl.label}
        </SvgText>
      ))}
    </Svg>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function WeightLogScreen() {
  const P       = usePalette();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const toast   = useToast();
  const posthog = usePostHog();
  const { width: screenWidth } = useWindowDimensions();
  const { entries, latest, logWeight, refresh } = useWeight();
  const { profile, updateProfile } = useProfile();
  const { weightUnit, toDisplayWeight, toKg } = useUnits();

  // 20px screen pad × 2  +  24px card pad × 2
  const chartWidth = screenWidth - 88;

  const defaultUnit: Unit = weightUnit;
  const latestWeightKg    = latest?.weight_kg ?? profile?.weightKg ?? null;
  const initialValue      = latestWeightKg === null
    ? '' : toDisplayWeight(latestWeightKg).toFixed(1);

  const [unit,   setUnit]   = useState<Unit>(defaultUnit);
  const [value,  setValue]  = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [range,  setRange]  = useState<TimeRange>('W');

  useEffect(() => { void refresh({ limit: 366 }); }, [refresh]);

  useEffect(() => {
    setUnit(defaultUnit);
    if (latestWeightKg === null) { setValue(''); return; }
    setValue(toDisplayWeight(latestWeightKg).toFixed(1));
  }, [defaultUnit, latestWeightKg, toDisplayWeight]);

  const numeric  = useMemo(() => parseFloat(value), [value]);
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
      posthog.capture('weight_logged', {
        value_kg: kg, unit,
        delta_kg: delta !== null ? (unit === 'lb' ? delta / 2.20462 : delta) : null,
      });
      toast.success('Saved', `${numeric.toFixed(1)} ${unit}`);
      router.back();
    } catch (err) {
      toast.error('Could not save', 'Please try again.');
      const e = err instanceof Error ? err : new Error(String(err));
      posthog.capture('$exception', {
        $exception_list: [{ type: e.name, value: e.message, stacktrace: { type: 'raw', frames: e.stack ?? '' } }],
        $exception_source: 'weight_logged',
      });
    } finally {
      setSaving(false);
    }
  };

  const acc = P.weight;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      {/* ── Header ──────────────────────────────────────────────── */}
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
        {/* ── Graph card ──────────────────────────────────────────── */}
        <AnimatedCard delay={60} padding={24} style={{ marginTop: 4 }}>
          <View style={styles.cardLabelRow}>
            <View style={[styles.labelPuck, { backgroundColor: acc + '22' }]}>
              <Ionicons name="trending-up-outline" size={13} color={acc} />
            </View>
            <Text style={[styles.cardLabel, { color: P.textFaint }]}>WEIGHT TREND</Text>

            {/* W / M / Y toggle */}
            <View style={[styles.rangeToggle, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
              {(['W', 'M', 'Y'] as TimeRange[]).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRange(r)}
                  style={[styles.rangeBtn, range === r && { backgroundColor: acc }]}
                >
                  <Text style={[styles.rangeBtnText, { color: range === r ? '#fff' : P.textDim }]}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <WeightChart
            entries={entries}
            unit={unit}
            acc={acc}
            chartWidth={chartWidth}
            range={range}
            palette={P}
          />
        </AnimatedCard>

        {/* ── Current weight input ─────────────────────────────────── */}
        <AnimatedCard delay={120} padding={0} style={{ overflow: 'hidden', marginTop: 12 }}>
          <View style={[styles.stripe, { backgroundColor: acc }]} />
          <View style={{ padding: 24 }}>
            <View style={styles.cardLabelRow}>
              <View style={[styles.labelPuck, { backgroundColor: acc + '22' }]}>
                <Ionicons name="scale-outline" size={13} color={acc} />
              </View>
              <Text style={[styles.cardLabel, { color: P.textFaint }]}>CURRENT WEIGHT</Text>
            </View>

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

            <View style={[styles.divider, { backgroundColor: P.hair }]} />

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

        {/* ── Fine tune ───────────────────────────────────────────── */}
        <View style={{ marginTop: 12 }}>
          <AnimatedCard delay={180}>
            <Text style={[styles.sectionLabel, { color: P.textFaint }]}>FINE TUNE</Text>
            <View style={styles.stepRow}>
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

        {/* ── Save ────────────────────────────────────────────────── */}
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

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, marginBottom: 2 },
  title:   { fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },

  unitToggle: {
    flexDirection: 'row', padding: 3, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, gap: 3,
  },
  unitBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  unitText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },

  cardLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
  },
  labelPuck: {
    width: 24, height: 24, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cardLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, flex: 1 },

  rangeToggle: {
    flexDirection: 'row', padding: 3, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, gap: 2,
  },
  rangeBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  rangeBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  stripe: { height: 3, borderTopLeftRadius: 24, borderTopRightRadius: 24 },

  inputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 4 },
  bigInput: { fontSize: 64, fontWeight: '800', letterSpacing: -3, padding: 0, minWidth: 140 },
  bigUnit:  { fontSize: 22, fontWeight: '700', letterSpacing: 0.4, paddingBottom: 6 },
  divider:  { height: StyleSheet.hairlineWidth, marginVertical: 18 },

  deltaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, alignSelf: 'flex-start',
  },
  deltaText: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },
  prevText:  { fontSize: 11, fontWeight: '600', letterSpacing: 0.1, marginLeft: 2 },

  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 12 },
  stepRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepGroup:    { flex: 1, flexDirection: 'row', gap: 6 },
  stepSep:      { width: StyleSheet.hairlineWidth, height: 36 },
  stepBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, alignItems: 'center',
  },
  stepText: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
});
