import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { RecoveryMonthCalendarBackdrop } from '@/components/recovery/RecoveryMonthCalendarBackdrop';
import { RecoveryTrendStatsRow } from '@/components/recovery/RecoveryTrendStatsRow';
import { RecoveryTrendHero } from '@/components/recovery/RecoveryTrendHero';
import type { ReadinessHistoryPoint } from '@/types/readiness';
import type { MonthCalendarCell, TrendPalette } from '@/components/recovery/recovery-trend-utils';
import {
  buildCurrentMonthGrid,
  computeTrendStats,
  currentMonthTitle,
  isToday,
  scoreSoft,
  scoreTint,
} from '@/components/recovery/recovery-trend-utils';
import { getLocalDateString } from '@/utils/date';

const SCREEN_PAD = 20;
const COLS = 7;
const HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const GAP = 5;

interface HeatmapCellProps {
  cell: MonthCalendarCell;
  score: number;
  size: number;
  palette: TrendPalette;
}

function HeatmapCell({ cell, score, size, palette }: HeatmapCellProps) {
  if (cell.date == null) {
    return <View style={{ width: size, height: size }} />;
  }

  const hasScore = score > 0;
  const today = isToday(cell.date);
  const future = cell.date > getLocalDateString();
  const tint = hasScore ? scoreTint(score, palette) : null;
  const soft = hasScore ? scoreSoft(score, palette) : null;

  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          borderColor: today ? tint ?? palette.text : 'transparent',
          borderWidth: today ? 2 : 0,
        },
      ]}
    >
      {hasScore && (
        <View style={[styles.scoreFill, { backgroundColor: soft ?? 'transparent' }]} />
      )}
      <Text style={[
        styles.cellDay,
        {
          color: hasScore
            ? palette.text
            : future
              ? palette.textFaint
              : palette.textDim,
        },
        today && { fontWeight: '700' },
      ]}>
        {cell.day}
      </Text>
      {hasScore && (
        <Text style={[styles.cellScore, { color: tint ?? palette.text }]}>
          {score}
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
  const coverage = stats.totalDays > 0
    ? Math.round((stats.loggedDays / stats.totalDays) * 100)
    : 0;

  const gridHeight = monthRows.length * cellSize + Math.max(0, monthRows.length - 1) * GAP;

  if (!hasData) {
    return (
      <View style={[styles.empty, { backgroundColor: palette.card, borderColor: palette.cardEdge }]}>
        <Ionicons name="calendar-outline" size={26} color={palette.textFaint} />
        <Text style={[styles.emptyTitle, { color: palette.text }]}>No monthly data yet</Text>
        <Text style={[styles.emptyBody, { color: palette.textFaint }]}>
          Keep logging recovery — your 30-day heatmap will fill in over time.
        </Text>
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
      />
      <RecoveryTrendStatsRow stats={stats} palette={palette} />
      <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardEdge }]}>
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

        <View style={[styles.gridStack, { minHeight: gridHeight }]}>
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
                  />
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.legend, { borderTopColor: palette.hair }]}>
          <LegendSwatch label="Low" color={palette.calories} palette={palette} />
          <LegendSwatch label="Fair" color={palette.carbs} palette={palette} />
          <LegendSwatch label="Optimal" color={palette.protein} palette={palette} />
          <LegendSwatch label="No data" color={palette.sunken} palette={palette} isEmpty />
        </View>
      </View>
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
  card: {
    borderRadius:      16,
    borderWidth:       StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     14,
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
  empty: {
    marginHorizontal:  SCREEN_PAD,
    alignItems:        'center',
    gap:               8,
    paddingVertical:   32,
    paddingHorizontal: 20,
    borderRadius:      16,
    borderWidth:       StyleSheet.hairlineWidth,
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
