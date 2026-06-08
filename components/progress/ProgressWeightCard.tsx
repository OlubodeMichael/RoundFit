import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import type { WeightEntry } from '@/context/weight-context';
import { usePalette } from '@/lib/log-theme';

const CHART_HEIGHT = 100;
const CHART_PAD_X = 10;
const CHART_PAD_Y = 10;
const GRADIENT_ID = 'progressWeightFill';
const DELTA_THRESHOLD_KG = 0.1;
const HEADER_ICON_SIZE = 32;

function weightLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${pts[i - 1].y.toFixed(1)},${cpX} ${pts[i].y.toFixed(1)},${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  return d;
}

function weightFillPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${CHART_HEIGHT} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${pts[i - 1].y.toFixed(1)},${cpX} ${pts[i].y.toFixed(1)},${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${CHART_HEIGHT} Z`;
  return d;
}

function weightTrendLabel(deltaKg: number, hasEntries: boolean): string {
  if (!hasEntries) return 'Your weight';
  if (deltaKg < -DELTA_THRESHOLD_KG) return 'Trending down';
  if (deltaKg > DELTA_THRESHOLD_KG) return 'Trending up';
  return 'Stable';
}

export interface ProgressWeightCardProps {
  entries: WeightEntry[];
  profileWeightKg: number | null;
  weightUnit: string;
  toDisplayWeight: (kg: number) => number;
  delay?: number;
}

export function ProgressWeightCard({
  entries,
  profileWeightKg,
  weightUnit,
  toDisplayWeight,
  delay = 400,
}: ProgressWeightCardProps) {
  const P = usePalette();
  const router = useRouter();
  const accent = getCardAccent('weight', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const [chartWidth, setChartWidth] = useState(0);

  const weightEntries = useMemo(
    () => entries.slice(0, 7).reverse(),
    [entries],
  );

  const weightMin = useMemo(
    () =>
      weightEntries.length
        ? Math.min(...weightEntries.map((e) => e.weight_kg))
        : 0,
    [weightEntries],
  );

  const weightMax = useMemo(
    () =>
      weightEntries.length
        ? Math.max(...weightEntries.map((e) => e.weight_kg))
        : 0,
    [weightEntries],
  );

  const weightRange = weightMax - weightMin || 1;

  const chartPoints = useMemo(() => {
    if (!chartWidth || !weightEntries.length) return [];
    const n = weightEntries.length;
    const cW = chartWidth - CHART_PAD_X * 2;
    const cH = CHART_HEIGHT - CHART_PAD_Y * 2;
    return weightEntries.map((w, i) => ({
      x: CHART_PAD_X + (n === 1 ? cW / 2 : (i / (n - 1)) * cW),
      y:
        CHART_PAD_Y +
        (n === 1
          ? cH / 2
          : (1 - (w.weight_kg - weightMin) / weightRange) * cH),
      isLatest: i === n - 1,
    }));
  }, [chartWidth, weightEntries, weightMin, weightRange]);

  const deltaKg =
    weightEntries.length >= 2
      ? weightEntries[weightEntries.length - 1].weight_kg -
        weightEntries[0].weight_kg
      : 0;

  const currentKg = weightEntries.length
    ? weightEntries[weightEntries.length - 1].weight_kg
    : profileWeightKg;

  const trendLabel = weightTrendLabel(deltaKg, weightEntries.length > 0);
  const showDeltaPill = weightEntries.length >= 2;
  const isDown = deltaKg <= -DELTA_THRESHOLD_KG;
  const isUp = deltaKg >= DELTA_THRESHOLD_KG;
  const deltaColor = isDown ? P.protein : isUp ? P.calories : P.textFaint;
  const deltaSoft = isDown ? P.proteinSoft : isUp ? P.caloriesSoft : P.sunken;
  const currentDisplay =
    currentKg !== null ? toDisplayWeight(currentKg).toFixed(1) : '—';

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/progress/weight')}
      accessibilityRole="button"
      accessibilityLabel="Open weight log"
      style={({ pressed }) => [pressed && s.pressedWrap]}
    >
      <GradientCard
        variant="weight"
        palette={palette}
        corner="bottom-right"
        delay={delay}
        animated
        contentStyle={[s.shell, { borderColor: accent.iconSoft }]}
      >
        <View style={s.header}>
          <View style={s.headerMain}>
            <Ionicons name="scale" size={HEADER_ICON_SIZE} color={accent.iconBg} />
            <View style={s.headerCopy}>
              <Text style={[s.headerLabel, { color: P.textDim }]}>
                Weight over time
              </Text>
              <Text style={[s.headerMeta, { color: P.text }]}>{trendLabel}</Text>
            </View>
          </View>
          <View style={s.headerEnd}>
            {showDeltaPill && (
              <View style={[s.trendPill, { backgroundColor: deltaSoft }]}>
                <Ionicons
                  name={
                    isDown ? 'trending-down' : isUp ? 'trending-up' : 'remove'
                  }
                  size={11}
                  color={deltaColor}
                />
                <Text style={[s.trendText, { color: deltaColor }]}>
                  {deltaKg > 0 ? '+' : ''}
                  {toDisplayWeight(Math.abs(deltaKg)).toFixed(1)} {weightUnit}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
          </View>
        </View>

        {weightEntries.length === 0 ? (
          <View style={s.emptyBlock}>
            <Text
              style={[
                s.heroValue,
                { color: currentKg !== null ? P.text : P.textFaint },
              ]}
            >
              {currentDisplay}
              {currentKg !== null && (
                <Text style={[s.heroUnit, { color: accent.iconBg }]}>
                  {' '}
                  {weightUnit}
                </Text>
              )}
            </Text>
            <Text style={[s.emptyNote, { color: P.textFaint }]}>
              {currentKg !== null
                ? 'From your profile · log to track changes'
                : 'No weight data · tap to log'}
            </Text>
          </View>
        ) : (
          <>
            <View
              style={s.chartSlot}
              onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
            >
              {chartWidth > 0 && (
                <Svg width={chartWidth} height={CHART_HEIGHT}>
                  <Defs>
                    <LinearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                      <Stop
                        offset="0"
                        stopColor={accent.iconBg}
                        stopOpacity={0.28}
                      />
                      <Stop
                        offset="1"
                        stopColor={accent.iconBg}
                        stopOpacity={0}
                      />
                    </LinearGradient>
                  </Defs>
                  {chartPoints.length >= 2 && (
                    <>
                      <Path
                        d={weightFillPath(chartPoints)}
                        fill={`url(#${GRADIENT_ID})`}
                      />
                      <Path
                        d={weightLinePath(chartPoints)}
                        fill="none"
                        stroke={accent.iconBg}
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
                      r={p.isLatest ? 5 : 3.5}
                      fill={p.isLatest ? accent.iconBg : P.card}
                      stroke={accent.iconBg}
                      strokeWidth={p.isLatest ? 0 : 2}
                    />
                  ))}
                </Svg>
              )}
            </View>

            <View style={s.dateRow}>
              {weightEntries.map((w, i) => (
                <View key={i} style={s.dateCol}>
                  <Text style={[s.dateLabel, { color: P.textFaint }]}>
                    {new Date(w.logged_at).getDate().toString()}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={[s.statsRow, { borderTopColor: P.cardEdge }]}>
          <View style={s.statCol}>
            <Text style={[s.statLabel, { color: P.textFaint }]}>Current</Text>
            <Text style={[s.statValue, { color: P.text }]}>
              {currentDisplay}
              <Text style={[s.statUnit, { color: P.textFaint }]}>
                {' '}
                {weightUnit}
              </Text>
            </Text>
          </View>
          {showDeltaPill && (
            <View style={[s.statCol, s.statColEnd]}>
              <Text style={[s.statLabel, { color: P.textFaint }]}>
                {weightEntries.length}-entry change
              </Text>
              <Text style={[s.statValue, { color: deltaColor }]}>
                {deltaKg > 0 ? '+' : deltaKg < 0 ? '−' : ''}
                {toDisplayWeight(Math.abs(deltaKg)).toFixed(1)}
                <Text style={[s.statUnit, { color: P.textFaint }]}>
                  {' '}
                  {weightUnit}
                </Text>
              </Text>
            </View>
          )}
        </View>
      </GradientCard>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pressedWrap: { opacity: 0.88 },
  shell: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  headerCopy: { flex: 1, gap: 3, minWidth: 0 },
  headerEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  headerMeta: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.35,
    lineHeight: 21,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chartSlot: {
    height: CHART_HEIGHT,
    marginTop: -4,
  },
  dateRow: { flexDirection: 'row' },
  dateCol: { flex: 1, alignItems: 'center' },
  dateLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  emptyBlock: { gap: 6 },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyNote: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  statCol: { flex: 1, gap: 4, minWidth: 0 },
  statColEnd: { alignItems: 'flex-end' },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
});
