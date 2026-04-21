import { useMemo, useState } from 'react';
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
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';

// ─── Dummy data ─────────────────────────────────────────────────────────────
type WeightEntry = { iso: string; label: string; dateShort: string; kg: number };

const HISTORY: WeightEntry[] = [
  { iso: '2026-03-19', label: '4 weeks ago',  dateShort: 'Mar 19', kg: 83.2 },
  { iso: '2026-03-26', label: '3 weeks ago',  dateShort: 'Mar 26', kg: 82.9 },
  { iso: '2026-04-02', label: '2 weeks ago',  dateShort: 'Apr 2',  kg: 82.6 },
  { iso: '2026-04-06', label: 'Mon',          dateShort: 'Apr 6',  kg: 82.4 },
  { iso: '2026-04-07', label: 'Tue',          dateShort: 'Apr 7',  kg: 82.1 },
  { iso: '2026-04-08', label: 'Wed',          dateShort: 'Apr 8',  kg: 81.9 },
  { iso: '2026-04-09', label: 'Thu',          dateShort: 'Apr 9',  kg: 82.0 },
  { iso: '2026-04-10', label: 'Fri',          dateShort: 'Apr 10', kg: 81.7 },
  { iso: '2026-04-11', label: 'Sat',          dateShort: 'Apr 11', kg: 81.5 },
  { iso: '2026-04-18', label: 'Today',        dateShort: 'Apr 18', kg: 81.3 },
];

const GOAL_KG = 78.0;

type RangeKey = '1W' | '1M' | '3M' | 'ALL';
const RANGES: RangeKey[] = ['1W', '1M', '3M', 'ALL'];

export default function WeightLogScreen() {
  const P      = usePalette();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>('1M');

  const series = useMemo(() => {
    if (range === '1W') return HISTORY.slice(-5);
    if (range === '1M') return HISTORY;
    return HISTORY;
  }, [range]);

  const current  = HISTORY[HISTORY.length - 1].kg;
  const starting = HISTORY[0].kg;
  const delta    = current - starting;
  const toGoal   = current - GOAL_KG;

  const min = Math.min(...series.map(s => s.kg));
  const max = Math.max(...series.map(s => s.kg));
  const pad2 = (max - min) * 0.15 || 0.8;
  const yMin = min - pad2;
  const yMax = max + pad2;
  const yRange = yMax - yMin;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="History"
          title="Weight"
          accent={P.weight}
          right={
            <Pressable
              hitSlop={10}
              onPress={() => router.push('/(tabs)/log/weight')}
              style={[styles.addBtn, { backgroundColor: P.weight }]}
            >
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          }
        />

        <View style={styles.stack}>
          {/* ── Hero card ─────────────────────────────────────── */}
          <AnimatedCard delay={60} style={{ overflow: 'hidden' }}>
            <View pointerEvents="none" style={[styles.glow, { backgroundColor: P.weightSoft, top: -80, right: -60 }]} />

            <Text style={[styles.heroEyebrow, { color: P.textFaint }]}>CURRENT</Text>
            <View style={styles.heroRow}>
              <Text style={[styles.heroValue, { color: P.text }]}>
                {current.toFixed(1)}
              </Text>
              <Text style={[styles.heroUnit, { color: P.textFaint }]}>kg</Text>
              <View style={[styles.trendPill, { backgroundColor: P.proteinSoft, marginLeft: 'auto' }]}>
                <Ionicons name="trending-down" size={11} color={P.protein} />
                <Text style={[styles.trendText, { color: P.protein }]}>
                  {delta.toFixed(1)} kg since start
                </Text>
              </View>
            </View>

            {/* Range segment */}
            <View style={[styles.segment, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
              {RANGES.map(r => {
                const active = r === range;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setRange(r)}
                    style={({ pressed }) => [
                      styles.segCell,
                      active && { backgroundColor: P.card },
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Text style={[
                      styles.segText,
                      { color: active ? P.text : P.textFaint },
                    ]}>
                      {r}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Line chart */}
            <View style={styles.chartWrap}>
              {/* Y axis gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map(t => (
                <View
                  key={t}
                  style={[styles.gridLine, { bottom: `${t * 100}%`, borderColor: P.hair }]}
                />
              ))}

              {/* Goal line */}
              {GOAL_KG >= yMin && GOAL_KG <= yMax && (
                <>
                  <View
                    style={[
                      styles.goalLine,
                      {
                        bottom:      `${((GOAL_KG - yMin) / yRange) * 100}%`,
                        borderColor: P.protein,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.goalTag,
                      { bottom: `${((GOAL_KG - yMin) / yRange) * 100}%`, backgroundColor: P.proteinSoft },
                    ]}
                  >
                    <Text style={[styles.goalTagText, { color: P.protein }]}>
                      GOAL {GOAL_KG.toFixed(1)}
                    </Text>
                  </View>
                </>
              )}

              {/* Line segments + dots */}
              {series.map((pt, i) => {
                const x1 = (i / (series.length - 1)) * 100;
                const y1 = ((pt.kg - yMin) / yRange) * 100;
                const next = series[i + 1];
                const isLast = i === series.length - 1;

                return (
                  <View key={pt.iso} style={StyleSheet.absoluteFill}>
                    {/* segment to next */}
                    {next && (() => {
                      const x2 = ((i + 1) / (series.length - 1)) * 100;
                      const y2 = ((next.kg - yMin) / yRange) * 100;
                      // inline segment as a rotated 2px View. Compute endpoints in %
                      // to avoid measuring: we render the segment as an absolutely
                      // positioned line using simple transforms.
                      const mxPct = (x1 + x2) / 2;
                      const myPct = (y1 + y2) / 2;
                      return (
                        <LineSegment
                          x1Pct={x1} y1Pct={y1} x2Pct={x2} y2Pct={y2}
                          color={P.weight} midX={mxPct} midY={myPct}
                        />
                      );
                    })()}

                    {/* dot */}
                    <View
                      style={[
                        styles.pt,
                        {
                          left:   `${x1}%`,
                          bottom: `${y1}%`,
                          backgroundColor: isLast ? P.weight : P.card,
                          borderColor:     isLast ? '#fff' : P.weight,
                          width:           isLast ? 14 : 8,
                          height:          isLast ? 14 : 8,
                          borderRadius:    isLast ? 7 : 4,
                          marginLeft:      isLast ? -7 : -4,
                          marginBottom:    isLast ? -7 : -4,
                          shadowColor:     P.weight,
                          shadowOpacity:   isLast ? 0.5 : 0,
                          shadowRadius:    isLast ? 10 : 0,
                          shadowOffset:    { width: 0, height: 0 },
                          borderWidth:     2,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>

            {/* x labels */}
            <View style={styles.xLabels}>
              {series.map((pt, i) => (
                <Text
                  key={pt.iso + i}
                  style={[styles.xLabel, { color: P.textFaint, flex: 1, textAlign: 'center' }]}
                >
                  {pt.dateShort.split(' ')[1]}
                </Text>
              ))}
            </View>
          </AnimatedCard>

          {/* ── Stat quad ──────────────────────────────────────── */}
          <AnimatedCard delay={140} padding={0}>
            <View style={styles.statGrid}>
              <StatCell label="Starting" value={`${starting.toFixed(1)} kg`} />
              <StatCellDivider />
              <StatCell label="Current"  value={`${current.toFixed(1)} kg`} tone="accent" />
              <StatCellDivider />
              <StatCell label="To goal"  value={`${toGoal.toFixed(1)} kg`} tone="positive" />
            </View>
          </AnimatedCard>

          {/* ── History list ───────────────────────────────────── */}
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.sectionTitle, { color: P.text }]}>History</Text>
          </View>

          <AnimatedCard delay={200} padding={0}>
            {[...HISTORY].reverse().map((entry, i, arr) => {
              const prev = arr[i + 1];
              const d = prev ? entry.kg - prev.kg : 0;
              const up = d > 0.05;
              const dn = d < -0.05;
              return (
                <View key={entry.iso}>
                  <View style={styles.histRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.histLabel, { color: P.text }]}>{entry.label}</Text>
                      <Text style={[styles.histDate, { color: P.textFaint }]}>{entry.dateShort}</Text>
                    </View>
                    <Text style={[styles.histValue, { color: P.text }]}>
                      {entry.kg.toFixed(1)}
                      <Text style={[styles.histUnit, { color: P.textFaint }]}> kg</Text>
                    </Text>
                    {prev && (
                      <View
                        style={[
                          styles.histDelta,
                          {
                            backgroundColor: up ? P.dangerSoft : dn ? P.proteinSoft : P.sunken,
                          },
                        ]}
                      >
                        <Ionicons
                          name={up ? 'arrow-up' : dn ? 'arrow-down' : 'remove'}
                          size={10}
                          color={up ? P.danger : dn ? P.protein : P.textFaint}
                        />
                        <Text style={[
                          styles.histDeltaText,
                          { color: up ? P.danger : dn ? P.protein : P.textFaint },
                        ]}>
                          {Math.abs(d).toFixed(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                  {i < arr.length - 1 && <View style={[styles.histDivider, { backgroundColor: P.hair }]} />}
                </View>
              );
            })}
          </AnimatedCard>

          {/* ── Log new reading CTA ────────────────────────────── */}
          <Pressable
            onPress={() => router.push('/(tabs)/log/weight')}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: P.weight },
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.ctaText}>Log today's weight</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Thin rotated View rendered as a line segment between two % points ─────
function LineSegment({
  x1Pct, y1Pct, x2Pct, y2Pct, color, midX, midY,
}: {
  x1Pct: number; y1Pct: number; x2Pct: number; y2Pct: number;
  color: string; midX: number; midY: number;
}) {
  // Convert % distances into a scale factor — we render a fixed-width line and
  // scale it. Because absolute positioning in % is fluid, we use a raw scale
  // approach: draw a 1-unit-wide line across the whole chart (pct-based), then
  // transform it with scaleX. Simpler: use a small line that we rotate and
  // translate using transformOrigin via percentages.
  // React Native doesn't expose transformOrigin per se, so we position a thin
  // line centered at the midpoint and rotate it — the length matches the
  // % delta using a scale factor.
  const dx  = x2Pct - x1Pct;
  const dy  = y2Pct - y1Pct;
  const ang = Math.atan2(dy, dx) * (180 / Math.PI);
  // Length as percentage of container width is √(dx² + dy²·(h/w)²). Since
  // absolute positioning treats both axes in raw %, we approximate length
  // using the width %. That's acceptable for our ~4:1 chart aspect.
  const lenPct = Math.hypot(dx, dy);

  return (
    <View
      pointerEvents="none"
      style={{
        position:    'absolute',
        left:        `${midX}%`,
        bottom:      `${midY}%`,
        width:       `${lenPct}%`,
        height:      2,
        marginLeft:  `${-lenPct / 2}%`,
        marginBottom: -1,
        backgroundColor: color,
        borderRadius:    1,
        transform: [{ rotate: `-${ang}deg` }],
      }}
    />
  );
}

function StatCell({
  label, value, tone,
}: { label: string; value: string; tone?: 'accent' | 'positive' }) {
  const P = usePalette();
  const color = tone === 'accent'   ? P.weight
              : tone === 'positive' ? P.protein
              :                       P.text;
  return (
    <View style={{ flex: 1, paddingVertical: 18, alignItems: 'center', gap: 5 }}>
      <Text style={{ fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: P.textFaint }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color }}>
        {value}
      </Text>
    </View>
  );
}

function StatCellDivider() {
  const P = usePalette();
  return <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: P.hair }} />;
}

const styles = StyleSheet.create({
  stack: {
    paddingHorizontal: 20,
    gap:               14,
  },

  addBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems:     'center',
    justifyContent: 'center',
  },

  glow: {
    position:     'absolute',
    width:        240,
    height:       240,
    borderRadius: 120,
  },

  heroEyebrow: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.8,
    marginBottom:  6,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           6,
    marginBottom:  18,
  },
  heroValue: {
    fontSize:      56,
    fontWeight:    '800',
    letterSpacing: -2.4,
    lineHeight:    60,
  },
  heroUnit: {
    fontSize:   16,
    fontWeight: '700',
    paddingBottom: 10,
  },
  trendPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      999,
    marginBottom:      8,
  },
  trendText: {
    fontSize:   10,
    fontWeight: '800',
  },

  segment: {
    flexDirection: 'row',
    padding:       3,
    borderRadius:  12,
    borderWidth:   StyleSheet.hairlineWidth,
    marginBottom:  20,
  },
  segCell: {
    flex:           1,
    alignItems:     'center',
    paddingVertical:7,
    borderRadius:   10,
  },
  segText: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 0.3,
  },

  chartWrap: {
    height:   160,
    position: 'relative',
  },
  gridLine: {
    position:       'absolute',
    left:           0,
    right:          0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  goalLine: {
    position:       'absolute',
    left:           0,
    right:          0,
    borderTopWidth: 1,
    borderStyle:    'dashed',
  },
  goalTag: {
    position:          'absolute',
    right:             0,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      6,
    marginBottom:      -8,
  },
  goalTagText: {
    fontSize:      8,
    fontWeight:    '800',
    letterSpacing: 0.8,
  },
  pt: {
    position: 'absolute',
  },

  xLabels: {
    flexDirection: 'row',
    marginTop:     10,
  },
  xLabel: {
    fontSize:   10,
    fontWeight: '600',
  },

  statGrid: {
    flexDirection: 'row',
  },

  sectionTitle: {
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.3,
    marginTop:     4,
  },

  histRow: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal:18,
    paddingVertical:  14,
    gap:              12,
  },
  histLabel: {
    fontSize:   14,
    fontWeight: '700',
  },
  histDate: {
    fontSize:   11,
    fontWeight: '500',
    marginTop:  2,
  },
  histValue: {
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: -0.4,
  },
  histUnit: {
    fontSize:   12,
    fontWeight: '600',
  },
  histDelta: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               3,
    paddingHorizontal: 7,
    paddingVertical:   4,
    borderRadius:      8,
    minWidth:          52,
    justifyContent:    'center',
  },
  histDeltaText: {
    fontSize:   11,
    fontWeight: '800',
  },
  histDivider: {
    height:       StyleSheet.hairlineWidth,
    marginLeft:   18,
  },

  cta: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    paddingVertical: 16,
    borderRadius:    16,
    marginTop:       8,
  },
  ctaText: {
    color:         '#fff',
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
});
