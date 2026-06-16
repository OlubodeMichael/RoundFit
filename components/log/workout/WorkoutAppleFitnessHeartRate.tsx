import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { WORKOUT_DETAIL_PAD } from '@/components/log/workout/workout-detail-layout';
import { GradientCard } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';
import type { HealthKitHeartRatePoint } from '@/utils/healthkit';

const BUCKET_COUNT = 32;
const Y_GUTTER_W = 30;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const PLOT_PAD_X = 2;
const PLOT_H = 118;
const CHART_H = PAD_TOP + PLOT_H + PAD_BOTTOM;

interface ChartTick {
  y: number;
  label: string;
}

interface XTick {
  x: number;
  label: string;
}

interface HeartRateChartModel {
  coords: { x: number; y: number; bpm: number }[];
  lineD: string;
  areaD: string;
  yTicks: ChartTick[];
  xTicks: XTick[];
  plotWidth: number;
  baseY: number;
}

export interface WorkoutAppleFitnessHeartRateProps {
  points: HealthKitHeartRatePoint[];
  workoutStart: Date;
  workoutEnd: Date;
  delay?: number;
}

function smoothAreaPath(coords: { x: number; y: number }[], baseY: number): string {
  if (coords.length < 2) return '';
  let d = `M ${coords[0].x.toFixed(1)} ${baseY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const cpX = ((coords[i - 1].x + coords[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${coords[i - 1].y.toFixed(1)},${cpX} ${coords[i].y.toFixed(1)},${coords[i].x.toFixed(1)} ${coords[i].y.toFixed(1)}`;
  }
  d += ` L ${coords[coords.length - 1].x.toFixed(1)} ${baseY.toFixed(1)} Z`;
  return d;
}

function smoothLinePath(coords: { x: number; y: number }[]): string {
  if (coords.length < 2) return '';
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const cpX = ((coords[i - 1].x + coords[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${coords[i - 1].y.toFixed(1)},${cpX} ${coords[i].y.toFixed(1)},${coords[i].x.toFixed(1)} ${coords[i].y.toFixed(1)}`;
  }
  return d;
}

function formatElapsedMs(elapsedMs: number): string {
  const totalSec = Math.max(0, Math.round(elapsedMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return '0m';
}

function buildElapsedTicks(
  workoutDurationMs: number,
  plotWidth: number,
): XTick[] {
  const spanMs = Math.max(workoutDurationMs, 1);
  const tickCount = spanMs < 20 * 60_000 ? 3 : spanMs < 60 * 60_000 ? 4 : 5;
  const plotLeft = PLOT_PAD_X;
  const innerW = Math.max(plotWidth - PLOT_PAD_X * 2, 1);

  return Array.from({ length: tickCount }, (_, index) => {
    const fraction = tickCount === 1 ? 0 : index / (tickCount - 1);
    return {
      x: plotLeft + innerW * fraction,
      label: formatElapsedMs(spanMs * fraction),
    };
  });
}

function buildBpmAxis(min: number, max: number): { ticks: number[]; axisMin: number; axisMax: number } {
  const spread = Math.max(max - min, 12);
  const axisMin = Math.max(40, Math.floor((min - spread * 0.1) / 5) * 5);
  const axisMax = Math.ceil((max + spread * 0.1) / 5) * 5;
  const step = Math.max(5, Math.ceil((axisMax - axisMin) / 2 / 5) * 5);
  const mid = axisMin + step;
  const ticks = mid < axisMax ? [axisMax, mid, axisMin] : [axisMax, axisMin];
  return { ticks, axisMin, axisMax };
}

function bpmToY(bpm: number, axisMin: number, axisMax: number): number {
  const span = Math.max(axisMax - axisMin, 1);
  return PAD_TOP + PLOT_H * (1 - (bpm - axisMin) / span);
}

function buildHeartRateChartModel(
  points: HealthKitHeartRatePoint[],
  plotWidth: number,
  workoutStart: Date,
  workoutEnd: Date,
): HeartRateChartModel | null {
  if (points.length === 0 || plotWidth <= 0) return null;

  const startMs = workoutStart.getTime();
  const endMs = workoutEnd.getTime();
  const durationMs = Math.max(endMs - startMs, 1);
  const windowPoints = points.filter((point) => {
    const t = point.timestamp.getTime();
    return t >= startMs && t <= endMs;
  });
  if (windowPoints.length < 2) return null;

  const peak = Math.max(...windowPoints.map((p) => p.bpm));
  const min = Math.min(...windowPoints.map((p) => p.bpm));
  const { ticks, axisMin, axisMax } = buildBpmAxis(min, peak);
  const baseY = PAD_TOP + PLOT_H;
  const plotLeft = PLOT_PAD_X;
  const plotRight = plotWidth - PLOT_PAD_X;
  const innerW = Math.max(plotRight - plotLeft, 1);

  const bucketMs = durationMs / BUCKET_COUNT;
  const buckets = Array.from({ length: BUCKET_COUNT }, () => 0);
  const counts = Array.from({ length: BUCKET_COUNT }, () => 0);

  for (const point of windowPoints) {
    const index = Math.min(
      BUCKET_COUNT - 1,
      Math.floor((point.timestamp.getTime() - startMs) / bucketMs),
    );
    buckets[index] += point.bpm;
    counts[index] += 1;
  }

  const values = buckets.map((sum, index) => (
    counts[index] > 0 ? Math.round(sum / counts[index]) : 0
  ));
  const step = values.length > 1 ? innerW / (values.length - 1) : 0;

  const coords = values
    .map((bpm, index) => {
      if (bpm <= 0) return null;
      return {
        x: plotLeft + index * step,
        y: bpmToY(bpm, axisMin, axisMax),
        bpm,
      };
    })
    .filter((c): c is { x: number; y: number; bpm: number } => c != null);

  if (coords.length < 2) return null;

  const yTicks = ticks.map((bpm) => ({
    y: bpmToY(bpm, axisMin, axisMax),
    label: String(bpm),
  }));

  return {
    coords,
    lineD: smoothLinePath(coords),
    areaD: smoothAreaPath(coords, baseY),
    yTicks,
    xTicks: buildElapsedTicks(durationMs, plotWidth),
    plotWidth,
    baseY,
  };
}

export function WorkoutAppleFitnessHeartRate({
  points,
  workoutStart,
  workoutEnd,
  delay = 160,
}: WorkoutAppleFitnessHeartRateProps) {
  const P = usePalette();
  const [plotWidth, setPlotWidth] = useState(0);

  const stats = useMemo(() => {
    if (points.length === 0) return null;
    const avg = Math.round(points.reduce((sum, p) => sum + p.bpm, 0) / points.length);
    const peak = Math.max(...points.map((p) => p.bpm));
    return { avg, peak };
  }, [points]);

  const chart = useMemo(
    () => buildHeartRateChartModel(points, plotWidth, workoutStart, workoutEnd),
    [plotWidth, points, workoutStart, workoutEnd],
  );

  if (stats == null) return null;

  const trackClr = P.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const axisClr = P.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
  const labelClr = P.textFaint;
  const plotLeft = PLOT_PAD_X;
  const plotRight = plotWidth - PLOT_PAD_X;
  const xLabelY = PAD_TOP + PLOT_H + 16;

  return (
    <View style={styles.wrap}>
      <GradientCard
        variant="workouts"
        palette={{ card: P.card, cardEdge: P.cardEdge, isDark: P.isDark }}
        corner="bottom-right"
        delay={delay}
        contentStyle={styles.card}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: P.textFaint }]}>HEART RATE</Text>
          <View style={styles.statRow}>
            <Text style={[styles.stat, { color: P.text }]}>
              {stats.avg}
              <Text style={[styles.statUnit, { color: P.textDim }]}> avg bpm</Text>
            </Text>
            <Text style={[styles.statDivider, { color: P.hair }]}>·</Text>
            <Text style={[styles.stat, { color: P.danger }]}>
              {stats.peak}
              <Text style={[styles.statUnit, { color: P.textDim }]}> peak</Text>
            </Text>
          </View>
        </View>

        <View style={styles.chartGrid}>
          <View style={styles.yGutter}>
            <Text style={[styles.axisUnit, { color: P.textFaint }]}>bpm</Text>
          </View>
          <View style={styles.plotHeader}>
            <Text style={[styles.axisUnit, styles.axisUnitRight, { color: P.textFaint }]}>duration</Text>
          </View>
        </View>

        <View style={styles.chartGrid}>
          <View style={[styles.yGutter, { height: CHART_H }]}>
            {chart?.yTicks.map((tick) => (
              <Text
                key={`y-${tick.label}`}
                style={[
                  styles.yLabel,
                  { top: tick.y - 5, color: labelClr },
                ]}
              >
                {tick.label}
              </Text>
            ))}
          </View>

          <View
            style={styles.plotArea}
            onLayout={(event) => {
              const width = Math.round(event.nativeEvent.layout.width);
              if (width > 0 && width !== plotWidth) setPlotWidth(width);
            }}
          >
            {chart != null && plotWidth > 0 && (
              <Svg
                width={plotWidth}
                height={CHART_H}
                accessibilityLabel={`Heart rate chart averaging ${stats.avg} beats per minute`}
              >
                <Defs>
                  <LinearGradient id="hrArea" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={P.danger} stopOpacity={P.isDark ? 0.35 : 0.22} />
                    <Stop offset="100%" stopColor={P.danger} stopOpacity={0} />
                  </LinearGradient>
                </Defs>

                {chart.yTicks.map((tick) => (
                  <Line
                    key={`grid-${tick.label}`}
                    x1={plotLeft}
                    y1={tick.y}
                    x2={plotRight}
                    y2={tick.y}
                    stroke={trackClr}
                    strokeWidth={1}
                  />
                ))}

                <Line
                  x1={plotLeft}
                  y1={PAD_TOP}
                  x2={plotLeft}
                  y2={chart.baseY}
                  stroke={axisClr}
                  strokeWidth={1}
                />
                <Line
                  x1={plotLeft}
                  y1={chart.baseY}
                  x2={plotRight}
                  y2={chart.baseY}
                  stroke={axisClr}
                  strokeWidth={1}
                />

                {chart.xTicks.map((tick, index) => (
                  <SvgText
                    key={`x-${tick.label}-${index}`}
                    x={tick.x}
                    y={xLabelY}
                    fill={labelClr}
                    fontSize={9}
                    fontWeight="600"
                    textAnchor={
                      index === 0
                        ? 'start'
                        : index === chart.xTicks.length - 1
                          ? 'end'
                          : 'middle'
                    }
                  >
                    {tick.label}
                  </SvgText>
                ))}

                {chart.areaD.length > 0 && <Path d={chart.areaD} fill="url(#hrArea)" />}
                {chart.lineD.length > 0 && (
                  <Path
                    d={chart.lineD}
                    fill="none"
                    stroke={P.danger}
                    strokeWidth={2.25}
                    strokeLinecap="round"
                  />
                )}
              </Svg>
            )}
          </View>
        </View>
      </GradientCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: WORKOUT_DETAIL_PAD, marginTop: 14 },
  card: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  header: { gap: 6, marginBottom: 10 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stat: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 13, fontWeight: '600' },
  statDivider: { fontSize: 16, fontWeight: '700' },
  chartGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  yGutter: {
    width: Y_GUTTER_W,
    position: 'relative',
  },
  plotHeader: {
    flex: 1,
  },
  plotArea: {
    flex: 1,
    minWidth: 0,
  },
  yLabel: {
    position: 'absolute',
    right: 4,
    fontSize: 9,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  axisUnit: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  axisUnitRight: {
    textAlign: 'right',
  },
});
