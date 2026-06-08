import type { lineDataItem } from 'react-native-gifted-charts';
import type { SleepSegment, SleepStage } from '@/utils/healthkit';

type ChartStage = 'awake' | 'rem' | 'core' | 'deep';

const CHART_STAGES: ChartStage[] = ['awake', 'rem', 'core', 'deep'];

const STAGE_VALUE: Record<ChartStage, number> = {
  awake: 3,
  rem:   2,
  core:  1,
  deep:  0,
};

const HK_STAGES: SleepStage[] = ['deep', 'core', 'rem', 'awake'];

function clampInterval(
  startMs: number,
  endMs: number,
  winStartMs: number,
  winEndMs: number,
): { startMs: number; endMs: number } | null {
  const s = Math.max(startMs, winStartMs);
  const e = Math.min(endMs, winEndMs);
  if (e <= s) return null;
  return { startMs: s, endMs: e };
}

export function buildHypnogramChartData(
  segments: SleepSegment[],
  winStartMs: number,
  winEndMs: number,
  chartWidth: number,
): lineDataItem[] {
  const totalMs = winEndMs - winStartMs;
  if (totalMs <= 0 || chartWidth <= 0) return [];

  const sortedSegs = [...segments]
    .filter((s) => (HK_STAGES as readonly string[]).includes(s.stage))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const times = new Set<number>();
  times.add(winStartMs);
  times.add(winEndMs);
  for (const seg of sortedSegs) {
    const iv = clampInterval(
      seg.start.getTime(),
      seg.end.getTime(),
      winStartMs,
      winEndMs,
    );
    if (!iv) continue;
    times.add(iv.startMs);
    times.add(iv.endMs);
  }

  const sorted = [...times]
    .filter((t) => t >= winStartMs && t <= winEndMs)
    .sort((a, b) => a - b);

  const raw: { value: number; weight: number }[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const dt = b - a;
    if (dt <= 0) continue;
    const mid = (a + b) / 2;
    let value = STAGE_VALUE.awake;
    for (const seg of sortedSegs) {
      const s = seg.start.getTime();
      const e = seg.end.getTime();
      if (mid >= s && mid < e && (CHART_STAGES as readonly string[]).includes(seg.stage)) {
        value = STAGE_VALUE[seg.stage as ChartStage];
        break;
      }
    }
    raw.push({ value, weight: dt / totalMs });
  }

  if (raw.length === 0) return [];

  const sumW = raw.reduce((acc, r) => acc + r.weight, 0);
  const scale = sumW > 0 ? chartWidth / sumW : 1;
  const data: lineDataItem[] = raw.map((r) => ({
    value: r.value,
    spacing: r.weight * scale,
  }));

  if (data.length === 1) {
    const v = data[0].value ?? 0;
    return [
      { value: v, spacing: chartWidth / 2 },
      { value: v, spacing: chartWidth / 2 },
    ];
  }

  return data;
}
