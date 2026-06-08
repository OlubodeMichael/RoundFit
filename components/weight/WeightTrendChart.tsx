import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import type { WeightEntry } from '@/context/weight-context';
import type { usePalette } from '@/lib/log-theme';
import { localDayOfMonth } from '@/utils/date';

// Shared weight trend chart used by both the Weight log screen and the Weight
// history (progress) screen so the two never drift / mismatch.

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

export interface WeightTrendChartProps {
  /** Weight entries, newest-first (as provided by useWeight). */
  entries: WeightEntry[];
  /** Accent colour for the line / fill / dots (typically palette.weight). */
  accent: string;
  palette: ReturnType<typeof usePalette>;
}

export function WeightTrendChart({ entries, accent, palette: P }: WeightTrendChartProps) {
  const [range, setRange] = useState<RangeKey>('1M');
  const [chartW, setChartW] = useState(0);

  // entries are newest-first; reverse for chart (oldest → newest)
  const allAsc = useMemo(() => [...entries].reverse(), [entries]);

  const series = useMemo(() => {
    if (range === '1W') return allAsc.filter((e) => e.logged_at >= daysAgo(7));
    if (range === '1M') return allAsc.filter((e) => e.logged_at >= daysAgo(30));
    if (range === '3M') return allAsc.filter((e) => e.logged_at >= daysAgo(90));
    return allAsc;
  }, [allAsc, range]);

  const kgs  = series.map((e) => e.weight_kg);
  const yMin = kgs.length ? Math.min(...kgs) : 0;
  const yMax = kgs.length ? Math.max(...kgs) : 1;
  const weightRange = yMax - yMin || 1;

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

  return (
    <>
      {/* Range segment */}
      <View style={[styles.segment, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
        {RANGES.map((r) => {
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
            onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
          >
            {chartW > 0 && (
              <Svg width={chartW} height={CHART_H}>
                <Defs>
                  <LinearGradient id="wgFill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={accent} stopOpacity={0.28} />
                    <Stop offset="1" stopColor={accent} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {chartPoints.length >= 2 && (
                  <>
                    <Path d={svgFill(chartPoints)} fill="url(#wgFill)" />
                    <Path
                      d={svgLine(chartPoints)}
                      fill="none"
                      stroke={accent}
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
                    fill={p.isLatest ? accent : P.card}
                    stroke={accent}
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
                {localDayOfMonth(pt.logged_at)}
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
    </>
  );
}

const styles = StyleSheet.create({
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
    height: CHART_H,
  },
  xLabels: {
    flexDirection: 'row', marginTop: 10,
  },
  xLabel: {
    fontSize: 10, fontWeight: '600',
  },
});
