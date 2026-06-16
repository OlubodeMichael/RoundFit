import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

import { RecoveryMonthCalendarBackdrop } from '@/components/recovery/RecoveryMonthCalendarBackdrop';
import { RecoveryTrendGradientCard } from '@/components/recovery/RecoveryTrendGradientCard';
import { getCardAccent } from '@/components/ui/GradientCard';
import { RecoveryTrendStatsRow } from '@/components/recovery/RecoveryTrendStatsRow';
import { RecoveryTrendHero } from '@/components/recovery/RecoveryTrendHero';
import type { ReadinessHistoryPoint } from '@/types/readiness';
import type { MonthCalendarCell, TrendPalette } from '@/components/recovery/recovery-trend-utils';
import {
  buildCurrentMonthGrid,
  computeTrendStats,
  currentMonthTitle,
  isToday,
  READINESS_BAND_COLORS,
  scoreTint,
} from '@/components/recovery/recovery-trend-utils';
import { getLocalDateString } from '@/utils/date';

const SCREEN_PAD = 20;
const COLS = 7;
const HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const GAP = 5;
/** Slightly darker surface behind the heatmap on light theme only. */
const CALENDAR_SURFACE_LIGHT = '#E8E8ED';

interface HeatmapCellProps {
  cell: MonthCalendarCell;
  score: number;
  size: number;
  palette: TrendPalette;
  todayScore: number | null;
}

/** Logged score for the cell, or today's live readiness when the cell is today. */
function cellPerformanceScore(
  loggedScore: number,
  isTodayCell: boolean,
  todayScore: number | null,
): number {
  if (isTodayCell && todayScore != null && todayScore > 0) {
    return todayScore;
  }
  return loggedScore;
}

function HeatmapCell({ cell, score, size, palette, todayScore }: HeatmapCellProps) {
  if (cell.date == null) {
    return <View style={{ width: size, height: size }} />;
  }

  const today = isToday(cell.date);
  const future = cell.date > getLocalDateString();
  const performanceScore = cellPerformanceScore(score, today, todayScore);
  const hasPerformance = performanceScore > 0;
  const accent = getCardAccent('readiness', palette.isDark, {
    readinessScore: hasPerformance ? performanceScore : 0,
  });
  const tint = hasPerformance ? scoreTint(performanceScore, palette) : null;

  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          borderColor: today
            ? accent.iconBg
            : hasPerformance
              ? accent.iconSoft
              : 'transparent',
          borderWidth: today ? 2 : hasPerformance ? StyleSheet.hairlineWidth : 0,
          backgroundColor: !hasPerformance && !future ? palette.sunken : 'transparent',
        },
      ]}
    >
      {hasPerformance && (
        <LinearGradient
          colors={[...accent.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.scoreFill}
        />
      )}
      <Text
        style={[
          styles.cellDay,
          {
            color: hasPerformance
              ? palette.text
              : future
                ? palette.textFaint
                : palette.textDim,
          },
          today && { fontWeight: '700' },
        ]}
      >
        {cell.day}
      </Text>
      {hasPerformance && (
        <Text style={[styles.cellScore, { color: tint ?? accent.iconBg }]}>
          {performanceScore}
        </Text>
      )}
    </View>
  );
}

export interface RecoveryMonthlyTrendProps {
  points: ReadinessHistoryPoint[];
  todayScore: number | null;
  gaugeLabel: string;
  tint: string;
  palette: TrendPalette;
}

export function RecoveryMonthlyTrend({
  points,
  todayScore,
  gaugeLabel,
  tint,
  palette,
}: RecoveryMonthlyTrendProps) {
  const { width } = useWindowDimensions();
  const innerWidth = width - SCREEN_PAD * 2 - 32;
  const cellSize = Math.floor((innerWidth - GAP * (COLS - 1)) / COLS);

  const monthRows = useMemo(() => buildCurrentMonthGrid(), []);
  const scoreByDate = useMemo(
    () => new Map(points.map((p) => [p.date, p.score])),
    [points],
  );

  const stats = computeTrendStats(points);
  const hasData = stats.loggedDays > 0;
  const readinessScore = todayScore ?? stats.average ?? 0;
  const coverage = stats.totalDays > 0
    ? Math.round((stats.loggedDays / stats.totalDays) * 100)
    : 0;

  const gridHeight = monthRows.length * cellSize + Math.max(0, monthRows.length - 1) * GAP;

  if (!hasData) {
    return (
      <View style={styles.wrap}>
        <RecoveryTrendGradientCard
          palette={palette}
          readinessScore={readinessScore}
          corner="bottom-left"
          contentStyle={styles.emptyInner}
        >
          <Ionicons name="calendar-outline" size={26} color={palette.textFaint} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>
            No monthly data yet
          </Text>
          <Text style={[styles.emptyBody, { color: palette.textFaint }]}>
            Keep logging recovery — your 30-day heatmap will fill in over time.
          </Text>
        </RecoveryTrendGradientCard>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <RecoveryTrendHero
        score={todayScore}
        gaugeLabel={gaugeLabel}
        tint={tint}
        periodTitle="LAST 30 DAYS"
        periodSubtitle={currentMonthTitle()}
        palette={palette}
        readinessScore={readinessScore}
      />
      <RecoveryTrendStatsRow
        stats={stats}
        palette={palette}
        readinessScore={readinessScore}
      />
      <RecoveryTrendGradientCard
        palette={palette}
        readinessScore={readinessScore}
        corner="bottom-left"
        contentStyle={styles.cardInner}
      >
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Readiness map</Text>
          <Text style={[styles.coverage, { color: palette.textFaint }]}>
            {coverage}% tracked
          </Text>
        </View>

        <View style={[styles.headerRow, { gap: GAP }]}>
          {HEADERS.map((h, i) => (
            <Text key={`${h}-${i}`} style={[styles.header, { width: cellSize, color: palette.textFaint }]}>
              {h}
            </Text>
          ))}
        </View>

        <View
          style={[
            styles.gridStack,
            { minHeight: gridHeight },
            !palette.isDark && styles.gridStackLight,
          ]}
        >
          <RecoveryMonthCalendarBackdrop
            cellSize={cellSize}
            gridHeight={gridHeight}
            palette={palette}
          />

          <View style={styles.foreground}>
            {monthRows.map((row, ri) => (
              <View
                key={`row-${ri}`}
                style={[styles.row, { gap: GAP, marginBottom: ri < monthRows.length - 1 ? GAP : 0 }]}
              >
                {row.map((cell, ci) => (
                  <HeatmapCell
                    key={cell.date ?? `pad-${ri}-${ci}`}
                    cell={cell}
                    score={cell.date ? (scoreByDate.get(cell.date) ?? 0) : 0}
                    size={cellSize}
                    palette={palette}
                    todayScore={todayScore}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.legend, { borderTopColor: palette.hair }]}>
          <LegendSwatch label="Low" color={READINESS_BAND_COLORS.low} palette={palette} />
          <LegendSwatch label="Fair" color={READINESS_BAND_COLORS.mid} palette={palette} />
          <LegendSwatch label="Optimal" color={READINESS_BAND_COLORS.high} palette={palette} />
          <LegendSwatch label="No data" color={palette.sunken} palette={palette} isEmpty />
        </View>
      </RecoveryTrendGradientCard>
    </View>
  );
}

function LegendSwatch({
  label,
  color,
  palette,
  isEmpty,
}: {
  label: string;
  color: string;
  palette: TrendPalette;
  isEmpty?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[
        styles.swatch,
        {
          backgroundColor: isEmpty ? palette.sunken : color,
          opacity: isEmpty ? 1 : 0.85,
        },
      ]} />
      <Text style={[styles.legendLabel, { color: palette.textFaint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    paddingHorizontal: SCREEN_PAD,
  },
  cardInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  emptyInner: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 8,
  },
  cardHead: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   12,
  },
  cardTitle: {
    fontSize:   15,
    fontWeight: '700',
  },
  coverage: {
    fontSize:   12,
    fontWeight: '600',
  },
  gridStack: {
    position: 'relative',
  },
  gridStackLight: {
    backgroundColor: CALENDAR_SURFACE_LIGHT,
    borderRadius:    12,
    padding:         8,
  },
  foreground: {
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom:  6,
  },
  header: {
    fontSize:   10,
    fontWeight: '700',
    textAlign:  'center',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            1,
    overflow:       'hidden',
  },
  scoreFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
  },
  cellDay: {
    fontSize:   12,
    fontWeight: '600',
    zIndex:     1,
  },
  cellScore: {
    fontSize:   11,
    fontWeight: '800',
    zIndex:     1,
  },
  legend: {
    flexDirection:  'row',
    justifyContent: 'center',
    flexWrap:       'wrap',
    gap:            14,
    marginTop:      14,
    paddingTop:     12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  swatch: {
    width:        10,
    height:       10,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize:   10,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize:   15,
    fontWeight: '800',
  },
  emptyBody: {
    fontSize:     13,
    fontWeight:   '500',
    textAlign:    'center',
    lineHeight:   19,
  },
});
