import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from '@/lib/log-theme';
import type { SleepSegment } from '@/utils/healthkit';
import {
  HYPNOGRAM_CHART_HEIGHT,
  SleepHypnogramPlot,
} from '@/components/log/SleepHypnogramPlot';

const LABEL_W    = 52;
const MIN_SEG_MS = 60_000;

const VALUE_MAX = 3;

type ChartStage = 'awake' | 'rem' | 'core' | 'deep';
const CHART_STAGES: ChartStage[] = ['awake', 'rem', 'core', 'deep'];

const STAGE_LABELS: Record<ChartStage, string> = {
  awake: 'Awake',
  rem:   'REM',
  core:  'Core',
  deep:  'Deep',
};

const STAGE_VALUE: Record<ChartStage, number> = {
  awake: 3,
  rem:   2,
  core:  1,
  deep:  0,
};

const GUTTER = 14;

export function SleepHypnogram({
  segments,
  windowStart: winStartProp,
  windowEnd:   winEndProp,
}: {
  segments:     SleepSegment[];
  windowStart?: Date;
  windowEnd?:   Date;
}) {
  const P = usePalette();

  const displaySegs = useMemo(
    () =>
      segments
        .filter(
          (s) =>
            (CHART_STAGES as string[]).includes(s.stage) &&
            s.end.getTime() - s.start.getTime() >= MIN_SEG_MS,
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [segments],
  );

  const winStart = useMemo(
    () => winStartProp ?? displaySegs[0]?.start ?? new Date(0),
    [winStartProp, displaySegs],
  );
  const winEnd = useMemo(
    () => winEndProp ?? displaySegs[displaySegs.length - 1]?.end ?? new Date(0),
    [winEndProp, displaySegs],
  );

  const totalMs = useMemo(
    () => winEnd.getTime() - winStart.getTime(),
    [winStart, winEnd],
  );

  const rowHeight = (HYPNOGRAM_CHART_HEIGHT - 2 * GUTTER) / 4;

  function bandTopForValue(v: number): number {
    return GUTTER + (VALUE_MAX - v) * rowHeight;
  }

  function labelTopForValue(v: number): number {
    return bandTopForValue(v) + rowHeight / 2 - 6;
  }

  const ticks = useMemo(() => {
    if (totalMs <= 0) return [];
    const result: Date[] = [];
    const cur = new Date(winStart);
    cur.setMinutes(0, 0, 0);
    if (cur.getTime() <= winStart.getTime()) cur.setHours(cur.getHours() + 1);
    while (cur.getTime() <= winEnd.getTime()) {
      result.push(new Date(cur));
      cur.setHours(cur.getHours() + 1);
    }
    return result;
  }, [winStart, winEnd, totalMs]);

  const winStartMs = winStart.getTime();
  const winEndMs   = winEnd.getTime();

  if (displaySegs.length === 0 || totalMs <= 0) return null;

  return (
    <View style={styles.root}>
      <View
        style={{ width: LABEL_W, height: HYPNOGRAM_CHART_HEIGHT, position: 'relative' }}
      >
        {CHART_STAGES.map((stage) => (
          <Text
            key={stage}
            style={[
              styles.stageLabel,
              {
                color: P.textFaint,
                top:   labelTopForValue(STAGE_VALUE[stage]),
              },
            ]}
          >
            {STAGE_LABELS[stage]}
          </Text>
        ))}
      </View>

      <SleepHypnogramPlot
        P={P}
        displaySegs={displaySegs}
        winStartMs={winStartMs}
        winEndMs={winEndMs}
        winStart={winStart}
        totalMs={totalMs}
        ticks={ticks}
        rowHeight={rowHeight}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
  },
  stageLabel: {
    position:      'absolute',
    right:         6,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 0.2,
    textAlign:     'right',
  },
});
