import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { Palette } from '@/lib/log-theme';
import type { SleepSegment } from '@/utils/healthkit';

export const HYPNOGRAM_CHART_HEIGHT = 160;
export const CHART_PAD_T = 10;
export const CHART_PAD_B = 20;

// Extra right margin so the last tick label isn't clipped
const PAD_R = 24;

type ChartStage = 'awake' | 'rem' | 'core' | 'deep';
const HK_STAGES = new Set<string>(['awake', 'rem', 'core', 'deep']);

const STAGE_NR: Record<ChartStage, number> = {
  awake: 0.08,
  rem:   0.44,
  core:  0.54,
  deep:  0.86,
};

export interface HypnogramPlotProps {
  P:           Palette;
  displaySegs: SleepSegment[];
  winStartMs:  number;
  winEndMs:    number;
  winStart:    Date;
  totalMs:     number;
  /** Fixed pixel width of the SVG — caller decides based on PX_PER_HOUR */
  width:       number;
}

function catmullRom(pts: { x: number; y: number }[], tension = 0.35): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function formatHour(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  if (h === 0)  return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function SleepHypnogramPlot({
  P,
  displaySegs,
  winStartMs,
  totalMs,
  width,
}: HypnogramPlotProps) {
  const plotW = width - PAD_R;
  const plotH = HYPNOGRAM_CHART_HEIGHT - CHART_PAD_T - CHART_PAD_B;

  const { linePath, areaPath } = useMemo(() => {
    if (plotW <= 0 || totalMs <= 0 || displaySegs.length === 0) {
      return { linePath: '', areaPath: '' };
    }

    const msToX = (ms: number) =>
      Math.max(0, Math.min(plotW, ((ms - winStartMs) / totalMs) * plotW));
    const stageToY = (s: ChartStage) =>
      CHART_PAD_T + (STAGE_NR[s] ?? 0.5) * plotH;

    const valid = displaySegs.filter((s) => HK_STAGES.has(s.stage));
    if (valid.length === 0) return { linePath: '', areaPath: '' };

    const pts: { x: number; y: number }[] = [];

    pts.push({
      x: msToX(valid[0].start.getTime()),
      y: stageToY(valid[0].stage as ChartStage),
    });
    for (const seg of valid) {
      const mid = (seg.start.getTime() + seg.end.getTime()) / 2;
      pts.push({ x: msToX(mid), y: stageToY(seg.stage as ChartStage) });
    }
    const last = valid[valid.length - 1];
    pts.push({
      x: msToX(last.end.getTime()),
      y: stageToY(last.stage as ChartStage),
    });

    const line    = catmullRom(pts, 0.35);
    const bottomY = CHART_PAD_T + plotH;
    const area    = `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${bottomY} L ${pts[0].x.toFixed(2)} ${bottomY} Z`;

    return { linePath: line, areaPath: area };
  }, [plotW, plotH, displaySegs, winStartMs, totalMs]);

  // Clock-time ticks: one per full hour that falls inside the window
  const hourTicks = useMemo(() => {
    if (totalMs <= 0 || plotW <= 0) return [];
    const msToX = (ms: number) =>
      Math.max(0, Math.min(plotW, ((ms - winStartMs) / totalMs) * plotW));

    const cur = new Date(winStartMs);
    cur.setMinutes(0, 0, 0);
    if (cur.getTime() < winStartMs) cur.setHours(cur.getHours() + 1);

    const ticks: { x: number; label: string }[] = [];
    while (cur.getTime() <= winStartMs + totalMs) {
      ticks.push({ x: msToX(cur.getTime()), label: formatHour(cur.getTime()) });
      cur.setHours(cur.getHours() + 1);
    }
    return ticks;
  }, [plotW, totalMs, winStartMs]);

  return (
    <View>
      <Svg width={width} height={HYPNOGRAM_CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={P.sleep} stopOpacity="0.22" />
            <Stop offset="1" stopColor={P.sleep} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {!!areaPath && <Path d={areaPath} fill="url(#sleepFill)" />}

        {!!linePath && (
          <Path
            d={linePath}
            stroke={P.sleep}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {hourTicks.map((t) => (
          <SvgText
            key={t.label}
            x={t.x}
            y={HYPNOGRAM_CHART_HEIGHT - 4}
            fontSize={9}
            fontWeight="600"
            fill={P.textFaint}
            textAnchor="middle"
          >
            {t.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
