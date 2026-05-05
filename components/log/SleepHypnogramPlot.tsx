import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '@/lib/log-theme';
import type { SleepSegment } from '@/utils/healthkit';

/** Plot height; left rail in `SleepHypnogram` must match. */
export const HYPNOGRAM_CHART_HEIGHT = 150;

const CHART_H   = HYPNOGRAM_CHART_HEIGHT;
const TIME_H    = 26;
const GUTTER    = 14;
const VALUE_MAX = 3;
const ROW_H     = (CHART_H - 2 * GUTTER) / 4;
const HAIR      = StyleSheet.hairlineWidth || 1;

type ChartStage = 'awake' | 'rem' | 'core' | 'deep';
const HK_STAGES = new Set<string>(['awake', 'rem', 'core', 'deep']);

const STAGE_VALUE: Record<ChartStage, number> = {
  awake: 3,
  rem:   2,
  core:  1,
  deep:  0,
};

function bandTop(v: number): number {
  return GUTTER + (VALUE_MAX - v) * ROW_H;
}

interface Props {
  P:           Palette;
  displaySegs: SleepSegment[];
  winStartMs:  number;
  winEndMs:    number;
  winStart:    Date;
  totalMs:     number;
  ticks:       Date[];
  rowHeight:   number;
}

export function SleepHypnogramPlot({
  P,
  displaySegs,
  winStartMs,
  totalMs,
  ticks,
}: Props) {
  const [chartWidth, setChartWidth] = useState(0);

  const segRects = useMemo(() => {
    if (chartWidth <= 0 || totalMs <= 0) return [];
    return displaySegs
      .filter((s) => HK_STAGES.has(s.stage))
      .map((seg, i) => {
        const stage     = seg.stage as ChartStage;
        const leftFrac  = (seg.start.getTime() - winStartMs) / totalMs;
        const widthFrac = (seg.end.getTime() - seg.start.getTime()) / totalMs;
        return {
          key:   i,
          left:  Math.max(leftFrac  * chartWidth, 0),
          width: Math.max(widthFrac * chartWidth, 1),
          top:   bandTop(STAGE_VALUE[stage]),
        };
      });
  }, [chartWidth, displaySegs, winStartMs, totalMs]);

  function tickToX(d: Date): number {
    if (totalMs <= 0 || chartWidth === 0) return 0;
    return ((d.getTime() - winStartMs) / totalMs) * chartWidth;
  }

  function formatTick(d: Date): string {
    const h = d.getHours();
    if (h === 0)  return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={[styles.chartArea, { height: CHART_H, backgroundColor: P.sunken }]}
        onLayout={(e: LayoutChangeEvent) =>
          setChartWidth(e.nativeEvent.layout.width)
        }
      >
        {chartWidth > 0 && (
          <>
            {/* Horizontal grid lines at stage boundaries */}
            {[1, 2, 3].map((n) => (
              <View
                key={`h-${n}`}
                style={{
                  position:        'absolute',
                  left:            0,
                  right:           0,
                  top:             GUTTER + n * ROW_H - HAIR / 2,
                  height:          HAIR,
                  backgroundColor: P.hair,
                }}
              />
            ))}

            {/* Vertical hour tick lines */}
            {ticks.map((tick, i) => (
              <View
                key={`v-${i}`}
                style={{
                  position:        'absolute',
                  top:             0,
                  bottom:          0,
                  left:            tickToX(tick) - HAIR / 2,
                  width:           HAIR,
                  backgroundColor: P.hair,
                }}
              />
            ))}

            {/* Sleep stage blocks */}
            {segRects.map((r) => (
              <View
                key={r.key}
                style={{
                  position:        'absolute',
                  left:            r.left,
                  width:           r.width,
                  top:             r.top,
                  height:          ROW_H,
                  backgroundColor: P.sleep,
                  opacity:         0.55,
                  borderRadius:    2,
                }}
              />
            ))}
          </>
        )}
      </View>

      {chartWidth > 0 && (
        <View style={{ height: TIME_H, position: 'relative', marginTop: 4 }}>
          {ticks.map((tick, i) => (
            <Text
              key={i}
              style={[
                styles.tickLabel,
                { color: P.textFaint, left: tickToX(tick) - 16 },
              ]}
            >
              {formatTick(tick)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chartArea: {
    position:     'relative',
    overflow:     'hidden',
    borderRadius: 8,
  },
  tickLabel: {
    position:   'absolute',
    top:        4,
    fontSize:   9,
    fontWeight: '600',
    width:      32,
    textAlign:  'center',
  },
});
