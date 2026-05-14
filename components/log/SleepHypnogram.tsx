import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePalette } from '@/lib/log-theme';
import type { SleepSegment } from '@/utils/healthkit';
import {
  CHART_PAD_B,
  CHART_PAD_T,
  HYPNOGRAM_CHART_HEIGHT,
  SleepHypnogramPlot,
} from '@/components/log/SleepHypnogramPlot';

const LABEL_W    = 52;
const MIN_SEG_MS = 60_000;

const PLOT_H = HYPNOGRAM_CHART_HEIGHT - CHART_PAD_T - CHART_PAD_B;

const LABEL_ROWS: { text: string; top: number }[] = [
  { text: 'Awake',        top: CHART_PAD_T + 0.08 * PLOT_H - 6  },
  { text: 'Light\nSleep', top: CHART_PAD_T + 0.49 * PLOT_H - 12 },
  { text: 'Deep\nsleep',  top: CHART_PAD_T + 0.86 * PLOT_H - 12 },
  { text: 'Time',         top: HYPNOGRAM_CHART_HEIGHT - CHART_PAD_B + 4 },
];

function formatMs(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function SleepHypnogram({
  segments,
  windowStart: winStartProp,
  windowEnd:   winEndProp,
}: {
  segments:     SleepSegment[];
  windowStart?: Date;
  windowEnd?:   Date;
}) {
  const P         = usePalette();
  const scrollRef = useRef<ScrollView>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  const displaySegs = useMemo(
    () =>
      segments
        .filter(
          (s) =>
            ['awake', 'rem', 'core', 'deep'].includes(s.stage) &&
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

  const totalMs = winEnd.getTime() - winStart.getTime();

  // Core sleep = first non-awake segment → last non-awake segment
  const firstSleep = useMemo(
    () => displaySegs.find((s) => s.stage !== 'awake'),
    [displaySegs],
  );
  const lastSleep = useMemo(
    () => [...displaySegs].reverse().find((s) => s.stage !== 'awake'),
    [displaySegs],
  );

  const coreSleepMs = useMemo(() => {
    if (!firstSleep || !lastSleep) return totalMs;
    return lastSleep.end.getTime() - firstSleep.start.getTime();
  }, [firstSleep, lastSleep, totalMs]);

  const deepSleepMs = useMemo(
    () =>
      displaySegs
        .filter((s) => s.stage === 'deep')
        .reduce((sum, s) => sum + s.end.getTime() - s.start.getTime(), 0),
    [displaySegs],
  );

  // Scale so the core sleep portion fills exactly one screen width
  const pxPerMs    = availableWidth > 0 && coreSleepMs > 0
    ? availableWidth / coreSleepMs
    : 0;
  const chartWidth = pxPerMs > 0 ? totalMs * pxPerMs : 0;

  // Offset so the chart opens showing the start of sleep (not pre-sleep awake)
  const sleepStartOffset = useMemo(() => {
    if (!firstSleep || pxPerMs === 0) return 0;
    return (firstSleep.start.getTime() - winStart.getTime()) * pxPerMs;
  }, [firstSleep, winStart, pxPerMs]);

  useEffect(() => {
    if (sleepStartOffset > 0) {
      scrollRef.current?.scrollTo({ x: sleepStartOffset, animated: false });
    }
  }, [sleepStartOffset]);

  if (displaySegs.length === 0 || totalMs <= 0) return null;

  return (
    <View>
      <View style={styles.root}>
        {/* Pinned y-axis labels */}
        <View style={{ width: LABEL_W, height: HYPNOGRAM_CHART_HEIGHT }}>
          {LABEL_ROWS.map((row) => (
            <Text
              key={row.text}
              style={[styles.stageLabel, { color: P.textFaint, top: row.top }]}
            >
              {row.text}
            </Text>
          ))}
        </View>

        {/* Horizontally scrollable chart */}
        <View
          style={{ flex: 1 }}
          onLayout={(e: LayoutChangeEvent) =>
            setAvailableWidth(e.nativeEvent.layout.width)
          }
        >
          {availableWidth > 0 && chartWidth > 0 && (
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="normal"
            >
              <SleepHypnogramPlot
                P={P}
                displaySegs={displaySegs}
                winStartMs={winStart.getTime()}
                winEndMs={winEnd.getTime()}
                winStart={winStart}
                totalMs={totalMs}
                width={chartWidth}
              />
            </ScrollView>
          )}
        </View>
      </View>

      {/* Deep sleep stat */}
      {deepSleepMs > 0 && (
        <View style={[styles.footer, { paddingLeft: LABEL_W }]}>
          <View style={styles.deepStat}>
            <View style={[styles.deepDot, { backgroundColor: P.sleep }]} />
            <Text style={[styles.deepText, { color: P.textFaint }]}>
              Deep sleep{' '}
              <Text style={{ color: P.text, fontWeight: '800' }}>
                {formatMs(deepSleepMs)}
              </Text>
            </Text>
          </View>
        </View>
      )}
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
    lineHeight:    11,
  },
  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    marginTop:      4,
    paddingRight:   4,
  },
  deepStat: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  deepDot: {
    width:        5,
    height:       5,
    borderRadius: 3,
  },
  deepText: {
    fontSize:   10,
    fontWeight: '600',
  },
});
