import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line } from 'react-native-svg';

import type { ReadinessHistoryPoint } from '@/types/readiness';
import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';
import {
  computeTrendStats,
  isToday,
  scoreTint,
  weekdayLetter,
} from '@/components/recovery/recovery-trend-utils';

const CHART_H = 128;
const PAD_TOP = 18;
const PAD_BOTTOM = 4;

export interface RecoveryWeeklyChartProps {
  points: ReadinessHistoryPoint[];
  tint: string;
  width: number;
  palette: TrendPalette;
}

function linePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${pts[i - 1].y.toFixed(1)},${cpX} ${pts[i].y.toFixed(1)},${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  return d;
}

function areaPath(pts: { x: number; y: number }[], baseY: number): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${baseY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cpX} ${pts[i - 1].y.toFixed(1)},${cpX} ${pts[i].y.toFixed(1)},${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${baseY.toFixed(1)} Z`;
  return d;
}

export function RecoveryWeeklyChart({ points, tint, width, palette }: RecoveryWeeklyChartProps) {
  const stats = useMemo(() => computeTrendStats(points), [points]);
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;

  const coords = useMemo(() => {
    const n = points.length;
    if (n === 0) return [];
    const step = n > 1 ? (width - 24) / (n - 1) : 0;
    return points.map((p, i) => {
      const score = p.score > 0 ? p.score : stats.average ?? 50;
      const x = 12 + i * step;
      const y = PAD_TOP + plotH * (1 - score / 100);
      return { ...p, x, y, score: p.score > 0 ? p.score : 0 };
    });
  }, [points, width, plotH, stats.average]);

  const avgY = stats.average != null
    ? PAD_TOP + plotH * (1 - stats.average / 100)
    : null;

  const trackClr = palette.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const lineD = linePath(coords);
  const areaD = areaPath(coords, baseY);

  return (
    <View>
      <Svg width={width} height={CHART_H}>
        <Defs>
          <LinearGradient id="wkArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={tint} stopOpacity={palette.isDark ? 0.35 : 0.22} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <Line
            key={f}
            x1={12}
            y1={PAD_TOP + plotH * f}
            x2={width - 12}
            y2={PAD_TOP + plotH * f}
            stroke={trackClr}
            strokeWidth={1}
          />
        ))}
        {avgY != null && (
          <Line
            x1={12}
            y1={avgY}
            x2={width - 12}
            y2={avgY}
            stroke={palette.textFaint}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.5}
          />
        )}
        {areaD.length > 0 && <Path d={areaD} fill="url(#wkArea)" />}
        {lineD.length > 0 && (
          <Path d={lineD} fill="none" stroke={tint} strokeWidth={2.5} strokeLinecap="round" />
        )}
        {coords.map((c) => {
          if (c.score <= 0) return null;
          const dotTint = scoreTint(c.score, palette);
          const today = isToday(c.date);
          return (
            <Circle
              key={c.date}
              cx={c.x}
              cy={c.y}
              r={today ? 6 : 4.5}
              fill={dotTint}
              stroke={today ? palette.card : 'transparent'}
              strokeWidth={today ? 2.5 : 0}
            />
          );
        })}
      </Svg>

      <View style={styles.labels}>
        {points.map((p) => {
          const today = isToday(p.date);
          return (
            <View key={p.date} style={styles.labelCol}>
              <Text style={[
                styles.score,
                { color: p.score > 0 ? palette.textDim : palette.textFaint },
                today && { color: palette.text, fontWeight: '800' },
              ]}>
                {p.score > 0 ? p.score : '·'}
              </Text>
              <Text style={[
                styles.day,
                { color: today ? tint : palette.textFaint },
                today && styles.dayToday,
              ]}>
                {weekdayLetter(p.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    marginTop: 6,
  },
  labelCol: {
    flex:       1,
    alignItems: 'center',
    gap:        2,
  },
  score: {
    fontSize:   10,
    fontWeight: '600',
  },
  day: {
    fontSize:   11,
    fontWeight: '700',
  },
  dayToday: {
    fontWeight: '800',
  },
});
