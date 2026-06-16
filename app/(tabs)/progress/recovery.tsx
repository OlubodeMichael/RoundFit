import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { RecoveryArcGauge } from '@/components/recovery/RecoveryArcGauge';
import { RecoveryDayMetrics } from '@/components/recovery/RecoveryDayMetrics';
import { RecoveryDaySkeleton } from '@/components/recovery/RecoveryDaySkeleton';
import { RecoveryFactorsCard } from '@/components/recovery/RecoveryFactorsCard';
import { RecoveryTrendGradientCard } from '@/components/recovery/RecoveryTrendGradientCard';
import { RecoveryTrendSkeleton } from '@/components/recovery/RecoveryTrendSkeleton';
import { RecoveryWeeklyTrend } from '@/components/recovery/RecoveryWeeklyTrend';
import { RecoveryMonthlyTrend } from '@/components/recovery/RecoveryMonthlyTrend';
import { useRecovery } from '@/hooks/use-recovery';
import { useHealth } from '@/context/health-context';
import { usePalette } from '@/lib/log-theme';
import { getLocalDateString } from '@/utils/date';
import type { ReadinessHistoryPoint, ReadinessFactor } from '@/types/readiness';
import {
  computeTrendStats,
  dayOfMonth,
  weekdayLetter,
  isToday,
  readinessStatusTint,
  scoreTint,
  READINESS_BAND_COLORS,
} from '@/components/recovery/recovery-trend-utils';
import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';
import { safeBack } from '@/utils/navigation';

type Period = 'D' | 'W' | 'M';
type P = ReturnType<typeof usePalette>;

// ── Layout constants ──────────────────────────────────────────────────────────
const SCREEN_PAD  = 20;
const SECTION_GAP = 20;
const GAUGE_MAX   = 272;

// ── Gauge label map ────────────────────────────────────────────────────────────

const GAUGE_LABELS: Record<string, string> = {
  'Train hard':    'OPTIMAL',
  'Moderate':      'GOOD',
  'Light workout': 'FAIR',
  'Rest':          'LOW',
};

// ── MetricRow ─────────────────────────────────────────────────────────────────

function MetricRow({ factor, last, palette }: {
  factor:  ReadinessFactor;
  last:    boolean;
  palette: P;
}) {
  const P = palette;
  const valueColor = factor.inactive
    ? P.textFaint
    : readinessStatusTint(factor.status);

  const deltaArrow = factor.inactive ? '•'
                   : factor.status === 'good' ? '▲'
                   : factor.status === 'poor'  ? '▼'
                   : '•';
  const deltaLabel = factor.statusLabel
    ?? (factor.inactive ? 'Inactive'
      : factor.status === 'good' ? 'Strong'
      : factor.status === 'poor'  ? 'Low'
      : 'Steady');
  const deltaColor = factor.inactive ? P.textFaint : valueColor;

  const displayScore = factor.ringScore != null ? factor.ringScore : factor.score;

  return (
    <View>
      <View style={ms.row}>
        {/* Left: label + note */}
        <View style={ms.left}>
          <Text style={[ms.label, { color: P.text }]} numberOfLines={1}>{factor.label}</Text>
          {factor.note.length > 0 && (
            <Text style={[ms.note, { color: P.textFaint }]} numberOfLines={1}>{factor.note}</Text>
          )}
        </View>
        {/* Right: score + status */}
        <View style={ms.right}>
          <Text style={[ms.score, { color: valueColor }]}>{displayScore}</Text>
          <Text style={[ms.status, { color: deltaColor }]}>{deltaArrow} {deltaLabel}</Text>
        </View>
      </View>
      {!last && <View style={[ms.divider, { backgroundColor: P.hair }]} />}
    </View>
  );
}

const ms = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   13,
    gap:               12,
  },
  left:  { flex: 1, gap: 3 },
  label: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  note:  { fontSize: 12, fontWeight: '500' },
  right: { alignItems: 'flex-end', gap: 2, minWidth: 52 },
  score: {
    fontFamily:    'Syne_700Bold',
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  status: {
    fontSize:   10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  divider: {
    height:     StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
});

// ── MiniTrendSection ──────────────────────────────────────────────────────────

const SPARKLINE_H = 72;
const SPARKLINE_PAD_TOP = 26;
const SPARKLINE_PAD_BOTTOM = 10;
const MINI_SCORE_LABEL_OFFSET = 11;
/** Keeps dots, halos, and score labels off the chart edges (matches weekly chart inset). */
const MINI_CHART_H_INSET = 12;

interface SparkDot {
  cx: number;
  cy: number;
  score: number;
  hasData: boolean;
  today: boolean;
  date: string;
}

/** Smooth bezier through ALL dots (including no-data ones at ground). Used for the dashed guide. */
function buildFullPath(dots: SparkDot[]): string {
  if (dots.length < 2) return '';
  let d = `M ${dots[0].cx.toFixed(1)} ${dots[0].cy.toFixed(1)}`;
  for (let i = 1; i < dots.length; i++) {
    const p0 = dots[i - 1];
    const p1 = dots[i];
    const t = (p1.cx - p0.cx) * 0.35;
    d += ` C ${(p0.cx + t).toFixed(1)} ${p0.cy.toFixed(1)} ${(p1.cx - t).toFixed(1)} ${p1.cy.toFixed(1)} ${p1.cx.toFixed(1)} ${p1.cy.toFixed(1)}`;
  }
  return d;
}

/** Solid bezier through data-only segments (no-data gaps create breaks). */
function buildDataPath(dots: SparkDot[]): string {
  const segs: SparkDot[][] = [];
  let cur: SparkDot[] = [];
  for (const dot of dots) {
    if (dot.hasData) { cur.push(dot); }
    else if (cur.length > 0) { segs.push(cur); cur = []; }
  }
  if (cur.length > 0) segs.push(cur);

  return segs.map((seg) => {
    if (seg.length < 2) return '';
    let d = `M ${seg[0].cx.toFixed(1)} ${seg[0].cy.toFixed(1)}`;
    for (let i = 1; i < seg.length; i++) {
      const p0 = seg[i - 1];
      const p1 = seg[i];
      const t = (p1.cx - p0.cx) * 0.35;
      d += ` C ${(p0.cx + t).toFixed(1)} ${p0.cy.toFixed(1)} ${(p1.cx - t).toFixed(1)} ${p1.cy.toFixed(1)} ${p1.cx.toFixed(1)} ${p1.cy.toFixed(1)}`;
    }
    return d;
  }).filter(Boolean).join(' ');
}

/** Area fill closed path for data-only segments. */
function buildAreaPath(dots: SparkDot[], bottom: number): string {
  const segs: SparkDot[][] = [];
  let cur: SparkDot[] = [];
  for (const dot of dots) {
    if (dot.hasData) { cur.push(dot); }
    else if (cur.length > 0) { segs.push(cur); cur = []; }
  }
  if (cur.length > 0) segs.push(cur);

  return segs.map((seg) => {
    if (seg.length < 2) return '';
    let d = `M ${seg[0].cx.toFixed(1)} ${seg[0].cy.toFixed(1)}`;
    for (let i = 1; i < seg.length; i++) {
      const p0 = seg[i - 1];
      const p1 = seg[i];
      const t = (p1.cx - p0.cx) * 0.35;
      d += ` C ${(p0.cx + t).toFixed(1)} ${p0.cy.toFixed(1)} ${(p1.cx - t).toFixed(1)} ${p1.cy.toFixed(1)} ${p1.cx.toFixed(1)} ${p1.cy.toFixed(1)}`;
    }
    d += ` L ${seg[seg.length - 1].cx.toFixed(1)} ${bottom} L ${seg[0].cx.toFixed(1)} ${bottom} Z`;
    return d;
  }).filter(Boolean).join(' ');
}

function MiniTrendSection({ points, tint, palette, readinessScore, onViewPress }: {
  points:          ReadinessHistoryPoint[];
  tint:            string;
  palette:         TrendPalette;
  readinessScore:  number;
  onViewPress:     () => void;
}) {
  const stats = computeTrendStats(points);
  const [plotWidth, setPlotWidth] = useState(0);
  const last7 = useMemo(() => points.slice(-7), [points]);

  const chartLayout = useMemo(() => {
    if (plotWidth <= 0 || last7.length === 0) return null;

    const validScores = last7.filter((p) => p.score > 0).map((p) => p.score);
    const minS = validScores.length > 0 ? Math.min(...validScores) : 0;
    const maxS = validScores.length > 0 ? Math.max(...validScores) : 100;
    const range = Math.max(maxS - minS, 20);
    const plotH = SPARKLINE_H - SPARKLINE_PAD_TOP - SPARKLINE_PAD_BOTTOM;
    const plotInnerW = plotWidth - MINI_CHART_H_INSET * 2;
    const slotW = plotInnerW / 7;

    const dots: SparkDot[] = last7.map((p, i) => {
      const hasData = p.score > 0;
      const cx = MINI_CHART_H_INSET + slotW * i + slotW / 2;
      const cy = hasData
        ? SPARKLINE_H - SPARKLINE_PAD_BOTTOM - ((p.score - minS) / range) * plotH
        : SPARKLINE_H;
      return { cx, cy, score: p.score, hasData, today: isToday(p.date), date: p.date };
    });

    const avgY = stats.average != null
      ? SPARKLINE_H - SPARKLINE_PAD_BOTTOM - ((stats.average - minS) / range) * plotH
      : null;

    return {
      slotW,
      dots,
      fullPath: buildFullPath(dots),
      dataPath: buildDataPath(dots),
      areaPath: buildAreaPath(dots, SPARKLINE_H),
      avgY,
    };
  }, [plotWidth, last7, stats.average]);

  if (points.length === 0) return null;

  const avgText  = stats.average != null ? `Avg ${stats.average}` : null;
  const daysText = stats.loggedDays > 0
    ? `${stats.loggedDays} day${stats.loggedDays !== 1 ? 's' : ''} logged`
    : 'No data yet';

  const gradFillId = 'mini-trend-fill';

  return (
    <View style={ts.sectionWrap}>
    <RecoveryTrendGradientCard
      palette={palette}
      readinessScore={readinessScore}
      corner="top-right"
      contentStyle={ts.wrap}
    >
      <View style={ts.header}>
        <Text style={[ts.sectionLabel, { color: palette.textFaint }]}>7-DAY TREND</Text>
        <TouchableOpacity onPress={onViewPress} activeOpacity={0.7} style={ts.viewBtn}>
          <Text style={[ts.viewText, { color: palette.textFaint }]}>View</Text>
          <Ionicons name="arrow-up-right-box" size={12} color={palette.textFaint} />
        </TouchableOpacity>
      </View>

      {/* Avg + days */}
      <View style={ts.summaryRow}>
        {avgText && (
          <Text style={[ts.avgScore, { color: palette.text }]}>{avgText}</Text>
        )}
        <Text style={[ts.avgDays, { color: palette.textFaint }]}>
          {avgText ? `  ·  ${daysText}` : daysText}
        </Text>
      </View>

      {/* Chart — width from layout so it stays inside card padding */}
      <View
        style={ts.chartArea}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== plotWidth) setPlotWidth(w);
        }}
      >
        {chartLayout != null && (
          <>
            <Svg width={plotWidth} height={SPARKLINE_H}>
              <Defs>
                <SvgLinearGradient id={gradFillId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%"   stopColor={tint} stopOpacity={palette.isDark ? 0.30 : 0.18} />
                  <Stop offset="100%" stopColor={tint} stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>

              {chartLayout.avgY != null && (
                <Path
                  d={`M ${MINI_CHART_H_INSET} ${chartLayout.avgY.toFixed(1)} L ${plotWidth - MINI_CHART_H_INSET} ${chartLayout.avgY.toFixed(1)}`}
                  stroke={palette.textFaint}
                  strokeWidth={1}
                  strokeOpacity={0.25}
                  strokeDasharray="3 5"
                  fill="none"
                />
              )}

              {chartLayout.areaPath.length > 0 && (
                <Path d={chartLayout.areaPath} fill={`url(#${gradFillId})`} />
              )}

              {chartLayout.fullPath.length > 0 && (
                <Path
                  d={chartLayout.fullPath}
                  fill="none"
                  stroke={tint}
                  strokeWidth={1.5}
                  strokeOpacity={0.30}
                  strokeDasharray="4 5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {chartLayout.dataPath.length > 0 && (
                <Path
                  d={chartLayout.dataPath}
                  fill="none"
                  stroke={tint}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {chartLayout.dots.map((d, i) => {
                if (!d.hasData) return null;
                const dotColor = scoreTint(d.score, palette);
                const labelY = d.cy - (d.today ? 13 : MINI_SCORE_LABEL_OFFSET);
                return (
                  <SvgText
                    key={`${d.date}-label`}
                    x={d.cx}
                    y={labelY}
                    fill={d.today ? palette.text : dotColor}
                    fontSize={d.today ? 11 : 10}
                    fontWeight={d.today ? '800' : '700'}
                    textAnchor="middle"
                  >
                    {d.score}
                  </SvgText>
                );
              })}

              {chartLayout.dots.map((d, i) => {
                if (!d.hasData) return null;
                const dotColor = scoreTint(d.score, palette);
                return (
                  <React.Fragment key={i}>
                    {d.today && (
                      <Circle cx={d.cx} cy={d.cy} r={10} fill={tint} opacity={palette.isDark ? 0.18 : 0.12} />
                    )}
                    <Circle
                      cx={d.cx}
                      cy={d.cy}
                      r={d.today ? 5.5 : 3.5}
                      fill={d.today ? tint : palette.card}
                      stroke={dotColor}
                      strokeWidth={d.today ? 0 : 1.5}
                    />
                  </React.Fragment>
                );
              })}
            </Svg>

            <View
              style={[
                ts.dayRow,
                { width: plotWidth, paddingHorizontal: MINI_CHART_H_INSET },
              ]}
            >
              {last7.map((p, i) => {
                const todayPt = isToday(p.date);
                return (
                  <View key={i} style={{ width: chartLayout.slotW, alignItems: 'center', gap: 1 }}>
                    <Text style={[ts.dayLabel, { color: todayPt ? tint : palette.textFaint }, todayPt && ts.dayLabelToday]}>
                      {weekdayLetter(p.date)}
                    </Text>
                    <Text style={[ts.dayDate, { color: todayPt ? tint : palette.textFaint }]}>
                      {dayOfMonth(p.date)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    </RecoveryTrendGradientCard>
    </View>
  );
}

const ts = StyleSheet.create({
  sectionWrap: {
    paddingHorizontal: SCREEN_PAD,
  },
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   6,
  },
  sectionLabel: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
  },
  viewText: {
    fontSize:   12,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    flexWrap:      'wrap',
  },
  chartArea: {
    width:         '100%',
    marginTop:     12,
    overflow:      'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    marginTop:     6,
  },
  avgScore: {
    fontSize:      20,
    fontWeight:    '800',
    letterSpacing: -0.5,
    fontFamily:    'Syne_700Bold',
  },
  avgDays: {
    fontSize:   13,
    fontWeight: '500',
  },
  dayLabel: {
    fontSize:   10,
    fontWeight: '600',
  },
  dayLabelToday: {
    fontWeight: '800',
  },
  dayDate: {
    fontSize:   9,
    fontWeight: '500',
  },
});

// ── Copy helpers ──────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WDAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function tintToRgb(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length === 6) {
    return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
  }
  return '128,128,128';
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WDAYS[d.getDay()].slice(0,3).toUpperCase()} · ${MONTHS[d.getMonth()].toUpperCase()} ${d.getDate()}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RecoveryScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { width } = useWindowDimensions();

  const backFallback: Href =
    typeof returnTo === 'string' && returnTo.length > 0
      ? returnTo
      : '/(tabs)/progress';

  const [period, setPeriod] = useState<Period>('D');

  const {
    display,
    today,
    computed,
    isLoading,
    initialized,
    hasInsufficientData,
    hrvBaseline,
    restingHrBaseline,
    refresh,
  } = useRecovery();

  // HealthKit data as fallback for chips when no recovery log is present
  const { today: healthToday, isLoading: healthIsLoading } = useHealth();

  useFocusEffect(
    useCallback(() => {
      if (!initialized) void refresh();
    }, [initialized, refresh]),
  );

  const score   = display.score;
  const rec     = display.recommendation;
  const factors = display.factors;
  const trend7d  = display.trend7d;
  const trend30d = display.trend30d;

  const tint = score !== null ? scoreTint(score, P) : READINESS_BAND_COLORS.high;

  const gaugeSize  = Math.min(Math.floor(width * 0.68), GAUGE_MAX);
  const gaugeLabel = rec ? (GAUGE_LABELS[rec] ?? '') : '';

  // Recovery log wins; fall back to HealthKit synced data
  const hrv   = today?.hrv               ?? healthToday?.hrv               ?? null;
  const rhr   = today?.resting_heart_rate ?? healthToday?.resting_heart_rate ?? null;
  const sleep = today?.sleep_hours        ?? healthToday?.sleep_hours        ?? null;

  const hrvDiff = hrv != null && hrvBaseline != null ? Math.round(hrv - hrvBaseline) : null;
  const rhrDiff = rhr != null && restingHrBaseline != null ? Math.round(rhr - restingHrBaseline) : null;

  const sleepScr    = display.sleepScore != null ? Math.round(display.sleepScore) : null;
  const sorenessLvl = computed?.soreness_level ?? today?.soreness_level ?? null;

  // Delta = today score − yesterday score (last point before today in trend7d)
  const scoreDelta: number | null = (() => {
    if (score === null || trend7d.length < 2) return null;
    const today7 = getLocalDateString();
    const withoutToday = trend7d.filter((p) => p.date !== today7 && p.score > 0);
    if (withoutToday.length === 0) return null;
    const prev = withoutToday[withoutToday.length - 1];
    return score - prev.score;
  })();

  const isCalculating = (isLoading && !initialized) || healthIsLoading;
  const showDayContent = period === 'D' && !isCalculating && !hasInsufficientData && (score !== null || initialized);

  return (
    <View style={[s.screen, { backgroundColor: P.bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Top nav ─────────────────────────────────────────────── */}
        <View style={s.topNav}>
          <TouchableOpacity
            onPress={() => safeBack(router, backFallback)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.navBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={P.text} />
          </TouchableOpacity>

          {/* Period selector */}
          <View style={[s.periodPill, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            {(['D', 'W', 'M'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                activeOpacity={0.75}
                style={[
                  s.periodBtn,
                  period === p && [s.periodBtnActive, { backgroundColor: P.isDark ? 'rgba(255,255,255,0.11)' : P.bg }],
                ]}
              >
                <Text style={[s.periodBtnText, { color: period === p ? P.text : P.textFaint }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.navBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={P.text} />
          </TouchableOpacity>
        </View>

        {/* ── Page title ──────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={[s.eyebrow, { color: P.textFaint }]}>{formatDate(getLocalDateString())}</Text>
          <Text style={[s.pageTitle, { color: P.text }]}>Recovery</Text>
        </View>

        {/* ── No data ─────────────────────────────────────────────── */}
        {period === 'D' && initialized && hasInsufficientData && !isCalculating && (
          <RecoveryTrendGradientCard
            palette={P}
            readinessScore={0}
            corner="top-left"
            style={s.emptyCardOuter}
            contentStyle={s.emptyCardInner}
          >
            <Ionicons name="analytics-outline" size={22} color={P.textFaint} />
            <Text style={[s.emptyTitle, { color: P.text }]}>Not enough data yet</Text>
            <Text style={[s.emptyText, { color: P.textFaint }]}>
              Log sleep, connect HealthKit, or complete a morning check-in to unlock your readiness score.
            </Text>
          </RecoveryTrendGradientCard>
        )}

        {period === 'D' && isCalculating && (
          <RecoveryDaySkeleton gaugeSize={gaugeSize} />
        )}

        {/* ── D — Day view ────────────────────────────────────────── */}
        {showDayContent && (
          <View style={s.dayContent}>

            {/* 1. Arc gauge with delta */}
            <View style={s.gaugeWrap}>
              <LinearGradient
                colors={[
                  `rgba(${tintToRgb(tint)},${P.isDark ? 0.13 : 0.07})`,
                  'transparent',
                ]}
                style={[s.gaugeGlow, { width: gaugeSize * 1.1, height: gaugeSize * 0.9 }]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
              <RecoveryArcGauge
                score={score}
                gaugeLabel={gaugeLabel}
                tint={tint}
                size={gaugeSize}
                delta={scoreDelta}
              />
            </View>

            {/* 2. Stat cards */}
            <RecoveryDayMetrics
              rhr={rhr}
              hrv={hrv}
              sleepHours={sleep}
              rhrDelta={rhrDiff}
              hrvDelta={hrvDiff}
              sleepScore={sleepScr}
              strain={display.strainScore != null
                ? parseFloat(((display.strainScore / 100) * 21).toFixed(1))
                : null}
              sorenessLevel={sorenessLvl}
              palette={P}
            />

            {/* 3. Mini 7-day trend inline */}
            {trend7d.length > 0 && (
              <MiniTrendSection
                points={trend7d}
                tint={tint}
                palette={P}
                readinessScore={score ?? 0}
                onViewPress={() => setPeriod('W')}
              />
            )}

            <RecoveryFactorsCard
              factors={factors}
              palette={P}
              readinessScore={score ?? 0}
              renderRow={(f, last) => (
                <MetricRow key={f.pillar} factor={f} last={last} palette={P} />
              )}
            />

          </View>
        )}

        {period === 'W' && isCalculating && (
          <RecoveryTrendSkeleton period="W" palette={P} tint={tint} />
        )}
        {period === 'W' && !isCalculating && (
          <RecoveryWeeklyTrend
            points={trend7d}
            todayScore={score}
            gaugeLabel={gaugeLabel}
            tint={tint}
            palette={P}
          />
        )}
        {period === 'M' && isCalculating && (
          <RecoveryTrendSkeleton period="M" palette={P} tint={tint} />
        )}
        {period === 'M' && !isCalculating && (
          <RecoveryMonthlyTrend
            points={trend30d}
            todayScore={score}
            gaugeLabel={gaugeLabel}
            tint={tint}
            palette={P}
          />
        )}

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1 },

  topNav: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: SCREEN_PAD,
    marginBottom:      10,
  },
  navBtn: {
    width:          36,
    height:         36,
    alignItems:     'center',
    justifyContent: 'center',
  },
  periodPill: {
    flexDirection: 'row',
    borderRadius:  10,
    borderWidth:   StyleSheet.hairlineWidth,
    padding:       3,
    gap:           2,
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical:   5,
    borderRadius:      7,
    alignItems:        'center',
    justifyContent:    'center',
    minWidth:          40,
  },
  periodBtnActive: {},
  periodBtnText: {
    fontSize:   13,
    fontWeight: '700',
  },

  header: {
    paddingHorizontal: SCREEN_PAD,
    marginBottom:      12,
  },
  eyebrow: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1.2,
    marginBottom:  4,
  },
  pageTitle: {
    fontFamily:    'Syne_700Bold',
    fontSize:      32,
    fontWeight:    '800',
    letterSpacing: -1,
    lineHeight:    36,
  },

  emptyCardOuter: {
    marginHorizontal: SCREEN_PAD,
    marginTop: SECTION_GAP,
  },
  emptyCardInner: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
    paddingHorizontal: SCREEN_PAD,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptyText:  { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },

  dayContent: {
    gap: SECTION_GAP,
  },

  gaugeWrap: {
    alignItems: 'center',
    marginTop:  -4,
  },
  gaugeGlow: {
    position:     'absolute',
    top:          0,
    alignSelf:    'center',
    borderRadius: 999,
  },

});
