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
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import {
  AnimatedCard,
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import { useWeight } from '@/hooks/use-weight';
import { useUnits } from '@/hooks/use-units';
import { useProfile } from '@/hooks/use-profile';


type RangeKey = '1W' | '1M' | '3M' | 'ALL';
const RANGES: RangeKey[] = ['1W', '1M', '3M', 'ALL'];

const CHART_H  = 160;
const CHART_PX = 12;
const CHART_PY = 14;

function svgLine(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${pts[i - 1].y.toFixed(1)},${cpX} ${pts[i].y.toFixed(1)},${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  return d;
}

function svgFill(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${CHART_H} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${pts[i - 1].y.toFixed(1)},${cpX} ${pts[i].y.toFixed(1)},${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${CHART_H} Z`;
  return d;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function histLabel(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)  return d.toLocaleDateString(undefined, { weekday: 'long' });
  if (diff < 30) return `${diff}d ago`;
  if (diff < 90) return `${Math.round(diff / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function xLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function WeightLogScreen() {
  const P      = usePalette();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { entries, latest } = useWeight();
  const { weightUnit, toDisplayWeight } = useUnits();
  const { profile } = useProfile();

  const [range, setRange] = useState<RangeKey>('1M');

  // entries are newest-first; reverse for chart (oldest → newest)
  const allAsc = useMemo(() => [...entries].reverse(), [entries]);

  const series = useMemo(() => {
    if (range === '1W') return allAsc.filter(e => e.logged_at >= daysAgo(7));
    if (range === '1M') return allAsc.filter(e => e.logged_at >= daysAgo(30));
    if (range === '3M') return allAsc.filter(e => e.logged_at >= daysAgo(90));
    return allAsc;
  }, [allAsc, range]);

  const currentKg  = latest?.weight_kg ?? profile?.weightKg ?? null;
  const startingKg = allAsc.length > 0 ? allAsc[0].weight_kg : currentKg;
  const deltaKg    = currentKg !== null && startingKg !== null ? currentKg - startingKg : 0;

  const currentDisplay  = currentKg  !== null ? toDisplayWeight(currentKg).toFixed(1)  : '—';
  const startingDisplay = startingKg !== null ? toDisplayWeight(startingKg).toFixed(1) : '—';
  const deltaDisplay    = toDisplayWeight(Math.abs(deltaKg)).toFixed(1);

  // Chart bounds
  const kgs  = series.map(e => e.weight_kg);
  const yMin = kgs.length ? Math.min(...kgs) : 0;
  const yMax = kgs.length ? Math.max(...kgs) : 1;
  const weightRange = yMax - yMin || 1;

  const [chartW, setChartW] = useState(0);
  const chartPoints = useMemo(() => {
    if (!chartW || series.length < 2) return [];
    const n  = series.length;
    const cW = chartW - CHART_PX * 2;
    const cH = CHART_H - CHART_PY * 2;
    return series.map((e, i) => ({
      x: CHART_PX + (i / (n - 1)) * cW,
      y: CHART_PY + (1 - (e.weight_kg - yMin) / weightRange) * cH,
      isLatest: i === n - 1,
    }));
  }, [chartW, series, yMin, weightRange]);

  const isEmpty = entries.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 24 }}
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

          {isEmpty ? (
            /* ── Empty state ─────────────────────────────────────── */
            <AnimatedCard delay={60}>
              <View style={{ alignItems: 'center', paddingVertical: 16, gap: 10 }}>
                <View style={[styles.emptyIcon, { backgroundColor: P.weightSoft }]}>
                  <Ionicons name="scale-outline" size={26} color={P.weight} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: P.text, letterSpacing: -0.3 }}>
                  No entries yet
                </Text>
                {currentKg !== null && (
                  <Text style={{ fontSize: 13, fontWeight: '500', color: P.textFaint, textAlign: 'center' }}>
                    Profile weight: {currentDisplay} {weightUnit}
                  </Text>
                )}
                <Text style={{ fontSize: 13, fontWeight: '500', color: P.textFaint, textAlign: 'center', paddingHorizontal: 16 }}>
                  Log your weight regularly to track your progress over time.
                </Text>
              </View>
            </AnimatedCard>
          ) : (
            /* ── Hero card ─────────────────────────────────────── */
            <AnimatedCard delay={60} style={{ overflow: 'hidden' }}>
              <View pointerEvents="none" style={[styles.glow, { backgroundColor: P.weightSoft, top: -80, right: -60 }]} />

              <Text style={[styles.heroEyebrow, { color: P.textFaint }]}>CURRENT</Text>
              <View style={styles.heroRow}>
                <Text style={[styles.heroValue, { color: P.text }]}>{currentDisplay}</Text>
                <Text style={[styles.heroUnit, { color: P.textFaint }]}>{weightUnit}</Text>
                {allAsc.length >= 2 && (
                  <View style={[
                    styles.trendPill,
                    { backgroundColor: deltaKg <= -0.1 ? P.proteinSoft : deltaKg >= 0.1 ? P.caloriesSoft : P.sunken, marginLeft: 'auto' },
                  ]}>
                    <Ionicons
                      name={deltaKg <= -0.1 ? 'trending-down' : deltaKg >= 0.1 ? 'trending-up' : 'remove'}
                      size={11}
                      color={deltaKg <= -0.1 ? P.protein : deltaKg >= 0.1 ? P.calories : P.textFaint}
                    />
                    <Text style={[styles.trendText, { color: deltaKg <= -0.1 ? P.protein : deltaKg >= 0.1 ? P.calories : P.textFaint }]}>
                      {deltaKg > 0 ? '+' : deltaKg < 0 ? '-' : ''}{deltaDisplay} {weightUnit}
                    </Text>
                  </View>
                )}
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
                      <Text style={[styles.segText, { color: active ? P.text : P.textFaint }]}>
                        {r}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* SVG line chart */}
              {series.length >= 2 ? (
                <>
                  <View
                    style={styles.chartWrap}
                    onLayout={e => setChartW(e.nativeEvent.layout.width)}
                  >
                    {chartW > 0 && (
                      <Svg width={chartW} height={CHART_H}>
                        <Defs>
                          <LinearGradient id="wgFill" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={P.weight} stopOpacity={0.28} />
                            <Stop offset="1" stopColor={P.weight} stopOpacity={0} />
                          </LinearGradient>
                        </Defs>
                        {chartPoints.length >= 2 && (
                          <>
                            <Path d={svgFill(chartPoints)} fill="url(#wgFill)" />
                            <Path
                              d={svgLine(chartPoints)}
                              fill="none"
                              stroke={P.weight}
                              strokeWidth={2.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </>
                        )}
                        {chartPoints.map((p, i) => (
                          <Circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={p.isLatest ? 6 : 4}
                            fill={p.isLatest ? P.weight : P.card}
                            stroke={P.weight}
                            strokeWidth={p.isLatest ? 0 : 2}
                          />
                        ))}
                      </Svg>
                    )}
                  </View>

                  <View style={styles.xLabels}>
                    {series.filter((_, i) => {
                      const maxLabels = 7;
                      if (series.length <= maxLabels) return true;
                      const step = Math.ceil(series.length / maxLabels);
                      return i % step === 0 || i === series.length - 1;
                    }).map((pt, i) => (
                      <Text key={i} style={[styles.xLabel, { color: P.textFaint, flex: 1, textAlign: 'center' }]}>
                        {xLabel(pt.logged_at).split(' ')[1]}
                      </Text>
                    ))}
                  </View>
                </>
              ) : (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ color: P.textFaint, fontSize: 13, fontWeight: '500' }}>
                    Log at least 2 entries to see a chart
                  </Text>
                </View>
              )}
            </AnimatedCard>
          )}

          {/* ── Stat quad ──────────────────────────────────────── */}
          {!isEmpty && (
            <AnimatedCard delay={140} padding={0}>
              <View style={styles.statGrid}>
                <StatCell label="Starting" value={`${startingDisplay} ${weightUnit}`} />
                <StatCellDivider />
                <StatCell label="Current"  value={`${currentDisplay} ${weightUnit}`}  tone="accent" />
                <StatCellDivider />
                <StatCell
                  label="Change"
                  value={`${deltaKg > 0 ? '+' : deltaKg < 0 ? '-' : ''}${deltaDisplay} ${weightUnit}`}
                  tone={deltaKg < -0.1 ? 'positive' : deltaKg > 0.1 ? 'negative' : undefined}
                />
              </View>
            </AnimatedCard>
          )}

          {/* ── History list ───────────────────────────────────── */}
          {!isEmpty && (
            <>
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.sectionTitle, { color: P.text }]}>History</Text>
              </View>

              <AnimatedCard delay={200} padding={0}>
                {entries.map((entry, i) => {
                  const prev = entries[i + 1];
                  const d    = prev ? entry.weight_kg - prev.weight_kg : 0;
                  const up   = d > 0.05;
                  const dn   = d < -0.05;
                  return (
                    <View key={entry.id ?? i}>
                      <View style={styles.histRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.histLabel, { color: P.text }]}>
                            {histLabel(entry.logged_at)}
                          </Text>
                          <Text style={[styles.histDate, { color: P.textFaint }]}>
                            {xLabel(entry.logged_at)}
                          </Text>
                        </View>

                        <Text style={[styles.histValue, { color: P.text }]}>
                          {toDisplayWeight(entry.weight_kg).toFixed(1)}
                          <Text style={[styles.histUnit, { color: P.textFaint }]}> {weightUnit}</Text>
                        </Text>
                        {prev && (
                          <View style={[
                            styles.histDelta,
                            { backgroundColor: up ? P.dangerSoft : dn ? P.proteinSoft : P.sunken },
                          ]}>
                            <Ionicons
                              name={up ? 'arrow-up' : dn ? 'arrow-down' : 'remove'}
                              size={10}
                              color={up ? P.danger : dn ? P.protein : P.textFaint}
                            />
                            <Text style={[
                              styles.histDeltaText,
                              { color: up ? P.danger : dn ? P.protein : P.textFaint },
                            ]}>
                              {toDisplayWeight(Math.abs(d)).toFixed(1)}
                            </Text>
                          </View>
                        )}
                      </View>
                      {i < entries.length - 1 && (
                        <View style={[styles.histDivider, { backgroundColor: P.hair }]} />
                      )}
                    </View>
                  );
                })}
              </AnimatedCard>
            </>
          )}

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
            <Text style={styles.ctaText}>Log today&apos;s weight</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}


function StatCell({
  label, value, tone,
}: { label: string; value: string; tone?: 'accent' | 'positive' | 'negative' }) {
  const P     = usePalette();
  const color = tone === 'accent'   ? P.weight
              : tone === 'positive' ? P.protein
              : tone === 'negative' ? P.calories
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
    alignItems: 'center', justifyContent: 'center',
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  glow: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
  },
  heroEyebrow: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 6,
  },
  heroRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 18,
  },
  heroValue: {
    fontSize: 56, fontWeight: '800', letterSpacing: -2.4, lineHeight: 60,
  },
  heroUnit: {
    fontSize: 16, fontWeight: '700', paddingBottom: 10,
  },
  trendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginBottom: 8,
  },
  trendText: {
    fontSize: 10, fontWeight: '800',
  },
  segment: {
    flexDirection: 'row', padding: 3, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, marginBottom: 20,
  },
  segCell: {
    flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 10,
  },
  segText: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.3,
  },
  chartWrap: {
    height: 160,
  },
  xLabels: {
    flexDirection: 'row', marginTop: 10,
  },
  xLabel: {
    fontSize: 10, fontWeight: '600',
  },
  statGrid: {
    flexDirection: 'row',
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', letterSpacing: -0.3, marginTop: 4,
  },
  histRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, gap: 12,
  },
  histLabel: {
    fontSize: 14, fontWeight: '700',
  },
  histDate: {
    fontSize: 11, fontWeight: '500', marginTop: 2,
  },
  histValue: {
    fontSize: 16, fontWeight: '800', letterSpacing: -0.4,
  },
  histUnit: {
    fontSize: 12, fontWeight: '600',
  },
  histDelta: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 4,
    borderRadius: 8, minWidth: 52, justifyContent: 'center',
  },
  histDeltaText: {
    fontSize: 11, fontWeight: '800',
  },
  histDivider: {
    height: StyleSheet.hairlineWidth, marginLeft: 18,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 8,
  },
  ctaText: {
    color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2,
  },
});
