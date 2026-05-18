import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { useRecovery } from '@/hooks/use-recovery';
import { useHealth } from '@/context/health-context';
import type { ReadinessHistoryPoint } from '@/types/readiness';
import { usePalette } from '@/lib/log-theme';
import { getLocalDateString } from '@/utils/date';

type Period = 'D' | 'W' | 'M';
type P = ReturnType<typeof usePalette>;

// ── Arc geometry ──────────────────────────────────────────────────────────────

const ARC_START = 225
const ARC_TOTAL = 270

function degToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = deg * (Math.PI / 180);
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}
function arcPath(cx: number, cy: number, r: number, startDeg: number, spanDeg: number): string {
  if (spanDeg <= 0) return '';
  const s = degToXY(cx, cy, r, startDeg);
  const e = degToXY(cx, cy, r, startDeg + spanDeg);
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${spanDeg > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ── Arc gauge ─────────────────────────────────────────────────────────────────

function ArcGauge({ score, gaugeLabel, tint, size }: {
  score:      number | null;
  gaugeLabel: string;
  tint:       string;
  size:       number;
}) {
  const P  = usePalette();
  const SW = Math.max(11, size * 0.054);
  const cx = size / 2;
  const cy = size / 2;
  const r  = cx - SW / 2 - 2;

  const value      = score ?? 0;
  const filledSpan = Math.max(value > 0 ? 4 : 0, (value / 100) * ARC_TOTAL);
  const tipDeg     = ARC_START + filledSpan;
  const tip        = degToXY(cx, cy, r, tipDeg);

  const trackClr = P.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <View style={{ width: size, height: Math.round(size * 0.78), overflow: 'hidden' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <RadialGradient id="rg" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={tint} stopOpacity={P.isDark ? 0.25 : 0.12} />
            <Stop offset="70%"  stopColor={tint} stopOpacity={P.isDark ? 0.06 : 0.03} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* Background glow */}
        <Circle cx={cx} cy={cy} r={r * 0.80} fill="url(#rg)" />
        {/* Track */}
        <Path
          d={arcPath(cx, cy, r, ARC_START, ARC_TOTAL)}
          stroke={trackClr}
          strokeWidth={SW}
          strokeLinecap="round"
          fill="none"
        />
        {/* Fill */}
        {value > 0 && (
          <Path
            d={arcPath(cx, cy, r, ARC_START, filledSpan)}
            stroke={tint}
            strokeWidth={SW}
            strokeLinecap="round"
            fill="none"
          />
        )}
        {/* Tip dot */}
        {value > 0 && (
          <Circle cx={tip.x} cy={tip.y} r={SW / 2 + 3} fill="#ffffff" />
        )}
      </Svg>

      <View style={[StyleSheet.absoluteFill, s.gaugeCenter]}>
        {gaugeLabel.length > 0 && (
          <Text style={[s.gaugeLabel, { color: tint }]}>{gaugeLabel}</Text>
        )}
        <Text style={[s.gaugeScore, { color: P.text }]}>
          {score !== null ? score : '—'}
        </Text>
        <Text style={[s.gaugeOf, { color: P.textFaint }]}>out of 100</Text>
      </View>
    </View>
  );
}

// ── Metric chip ───────────────────────────────────────────────────────────────

function MetricChip({ label, value, unit, delta, deltaGood, palette }: {
  label:      string;
  value:      string | null;
  unit:       string;
  delta?:     string | null;
  deltaGood?: boolean;
  palette:    P;
}) {
  const P = palette;
  return (
    <View style={[s.chip, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
      <Text style={[s.chipLabel, { color: P.textFaint }]}>{label}</Text>
      <View style={s.chipValueRow}>
        <Text style={[s.chipValue, { color: P.text }]}>{value ?? '—'}</Text>
        <Text style={[s.chipUnit, { color: P.textFaint }]}>{unit}</Text>
      </View>
      <Text style={[s.chipDelta, {
        color: delta != null
          ? (deltaGood ? P.protein : P.calories)
          : 'transparent',
      }]}>
        {delta ?? '·'}
      </Text>
    </View>
  );
}

// ── Factor bar ────────────────────────────────────────────────────────────────

function FactorBar({ label, score, note, status, last, palette }: {
  label:   string;
  score:   number;
  note:    string;
  status:  'good' | 'ok' | 'poor';
  last:    boolean;
  palette: P;
}) {
  const P        = palette;
  const barColor = status === 'good' ? P.protein : status === 'ok' ? P.carbs : P.calories;

  return (
    <View>
      <View style={s.factorRow}>
        <View style={s.factorLeft}>
          <Text style={[s.factorLabel, { color: P.text }]}>{label}</Text>
          <View style={[s.barTrack, { backgroundColor: P.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }]}>
            <View style={[s.barFill, { width: `${Math.min(score, 100)}%`, backgroundColor: barColor }]} />
          </View>
        </View>
        <View style={s.factorRight}>
          <Text style={[s.factorScore, { color: P.text }]}>{score}</Text>
          {note.length > 0 && (
            <Text style={[s.factorNote, { color: barColor }]} numberOfLines={1}>{note}</Text>
          )}
        </View>
      </View>
      {!last && <View style={[s.factorDivider, { backgroundColor: P.hair }]} />}
    </View>
  );
}

// ── Trend (W / M) view ────────────────────────────────────────────────────────

function TrendView({ trend, tint, palette }: {
  trend:   ReadinessHistoryPoint[];
  tint:    string;
  palette: P;
}) {
  const P = palette;
  const BAR_H = 110;

  if (trend.length === 0) {
    return (
      <View style={s.centered}>
        <Ionicons name="analytics-outline" size={24} color={P.textFaint} />
        <Text style={[s.emptyText, { color: P.textFaint }]}>No trend data yet</Text>
      </View>
    );
  }

  return (
    <View style={s.trendWrap}>
      <View style={s.trendBars}>
        {trend.map((pt) => {
          const d        = new Date(`${pt.date}T12:00:00`);
          const dayLabel = ['S','M','T','W','T','F','S'][d.getDay()];
          const barH     = Math.max(4, Math.round((pt.score / 100) * BAR_H));
          const color    = pt.score >= 70 ? tint : pt.score >= 40 ? P.carbs : P.calories;
          return (
            <View key={pt.date} style={s.trendBarCol}>
              <Text style={[s.trendScore, { color: P.textFaint }]}>{pt.score}</Text>
              <View style={[s.trendBarTrack, { height: BAR_H }]}>
                <View style={[s.trendBarFill, { height: barH, backgroundColor: color }]} />
              </View>
              <Text style={[s.trendDay, { color: P.textFaint }]}>{dayLabel}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[s.trendCaption, { color: P.textFaint }]}>
        Last {trend.length} days · Readiness score
      </Text>
    </View>
  );
}

// ── Copy helpers ──────────────────────────────────────────────────────────────

const GAUGE_LABELS: Record<string, string> = {
  'Train hard':    'OPTIMAL',
  'Moderate':      'GOOD',
  'Light workout': 'FAIR',
  'Rest':          'LOW',
};

function insightParts(rec: string | null): [string, string, string] {
  switch (rec) {
    case 'Train hard':    return ['Your body is primed.', ' Push it today', ' — high-intensity training is recommended.'];
    case 'Moderate':      return ['You\'re in good shape.', ' Train with purpose', ' — moderate effort is ideal.'];
    case 'Light workout': return ['Your body needs care.', ' Take it easy', ' — light movement or stretching is best.'];
    case 'Rest':          return ['Your body is asking to recover.', ' Rest today', ' — prioritize sleep and nutrition.'];
    default:              return ['Sync health data or log recovery', ' to unlock', ' your readiness score.'];
  }
}

const PLAN_COPY: Record<string, string> = {
  'Train hard':    'High-intensity intervals — 35 min',
  'Moderate':      'Strength training — 40 min',
  'Light workout': 'Yoga or mobility — 30 min',
  'Rest':          'Walk & stretch — 20 min',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WDAYS  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WDAYS[d.getDay()].slice(0,3).toUpperCase()} · ${MONTHS[d.getMonth()].toUpperCase()} ${d.getDate()}`;
}
function fmtDelta(diff: number, unit: string): string {
  return diff >= 0 ? `+${diff} ${unit}` : `${diff} ${unit}`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RecoveryScreen() {
  const P      = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [period, setPeriod] = useState<Period>('D');

  const {
    display,
    today,
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
  const trend   = display.trend7d;

  const tint = score !== null
    ? score >= 70 ? P.protein : score >= 40 ? P.carbs : P.calories
    : P.protein;

  const gaugeSize  = Math.floor(width - 48);
  const gaugeLabel = rec ? (GAUGE_LABELS[rec] ?? '') : '';

  // Recovery log wins; fall back to HealthKit synced data
  const hrv   = today?.hrv               ?? healthToday?.hrv               ?? null;
  const rhr   = today?.resting_heart_rate ?? healthToday?.resting_heart_rate ?? null;
  const sleep = today?.sleep_hours        ?? healthToday?.sleep_hours        ?? null;

  const hrvDiff = hrv != null && hrvBaseline != null ? Math.round(hrv - hrvBaseline) : null;
  const rhrDiff = rhr != null && restingHrBaseline != null ? Math.round(rhr - restingHrBaseline) : null;

  const [partA, partB, partC] = insightParts(rec ?? null);
  const planText = rec ? PLAN_COPY[rec] : null;

  const sleepScr  = display.sleepScore != null ? Math.round(display.sleepScore) : null;

  return (
    <View style={[s.screen, { backgroundColor: P.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 36 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Top nav ─────────────────────────────────────────────── */}
        <View style={s.topNav}>
          <TouchableOpacity
            onPress={() => router.navigate('/(tabs)/progress')}
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

        {/* ── Loading ─────────────────────────────────────────────── */}
        {((isLoading && !initialized) || healthIsLoading) && (
          <View style={s.centered}>
            <ActivityIndicator color={tint} />
            <Text style={[s.emptyText, { color: P.textFaint }]}>Calculating readiness…</Text>
          </View>
        )}

        {/* ── No data ─────────────────────────────────────────────── */}
        {initialized && hasInsufficientData && !healthIsLoading && (
          <View style={[s.emptyCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <Ionicons name="analytics-outline" size={22} color={P.textFaint} />
            <Text style={[s.emptyTitle, { color: P.text }]}>Not enough data yet</Text>
            <Text style={[s.emptyText, { color: P.textFaint }]}>
              Log sleep, connect HealthKit, or complete a morning check-in to unlock your readiness score.
            </Text>
          </View>
        )}

        {/* ── D — Day view ────────────────────────────────────────── */}
        {period === 'D' && !hasInsufficientData && (score !== null || initialized) && (
          <>
            {/* Arc gauge */}
            <View style={s.gaugeWrap}>
              <ArcGauge score={score} gaugeLabel={gaugeLabel} tint={tint} size={gaugeSize} />
            </View>

            {/* Insight */}
            <View style={s.insightWrap}>
              <Text style={[s.insightText, { color: P.textDim }]}>
                {partA}
                <Text style={[s.insightBold, { color: P.text }]}>{partB}</Text>
                {partC}
              </Text>
            </View>

            {/* Metrics row */}
            <View style={s.metricsRow}>
              <MetricChip
                label="RHR"
                value={rhr ? String(Math.round(rhr)) : null}
                unit="bpm"
                delta={rhrDiff != null ? fmtDelta(rhrDiff, 'bpm') : null}
                deltaGood={rhrDiff != null ? rhrDiff <= 0 : true}
                palette={P}
              />
              <MetricChip
                label="HRV"
                value={hrv ? String(Math.round(hrv)) : null}
                unit="ms"
                delta={hrvDiff != null ? fmtDelta(hrvDiff, 'ms') : null}
                deltaGood={hrvDiff != null ? hrvDiff >= 0 : true}
                palette={P}
              />
              <MetricChip
                label="SLEEP"
                value={sleep ? sleep.toFixed(1) : null}
                unit="hrs"
                delta={sleepScr != null ? String(sleepScr) : null}
                deltaGood={sleepScr != null ? sleepScr >= 60 : true}
                palette={P}
              />
            </View>

            {/* Factors */}
            {factors.length > 0 && (
              <View style={s.factorsWrap}>
                <View style={s.factorsHeader}>
                  <Text style={[s.factorsTitle, { color: P.textFaint }]}>WHAT MOVED THE SCORE</Text>
                  <Ionicons name="trending-up-outline" size={13} color={P.textFaint} />
                </View>
                <View style={[s.factorsCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
                  {factors.map((f, i) => (
                    <FactorBar
                      key={f.pillar}
                      label={f.label}
                      score={f.ringScore ?? f.score}
                      note={f.note}
                      status={f.status}
                      last={i === factors.length - 1}
                      palette={P}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* CTA */}
            {planText && (
              <TouchableOpacity
                activeOpacity={0.82}
                style={[s.cta, { backgroundColor: tint }]}
              >
                <View style={s.ctaLeft}>
                  <View style={s.ctaIconWrap}>
                    <Ionicons name="star" size={14} color="#fff" />
                  </View>
                  <View>
                    <Text style={s.ctaEyebrow}>TODAY&apos;S PLAN</Text>
                    <Text style={s.ctaText}>{planText}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── W / M — Trend view ──────────────────────────────────── */}
        {(period === 'W' || period === 'M') && (
          <>
            {score !== null && (
              <View style={s.trendScoreRow}>
                <Text style={[s.trendScoreNum, { color: P.text }]}>{score}</Text>
                <View style={{ gap: 2 }}>
                  <Text style={[s.trendScoreLabel, { color: tint }]}>{gaugeLabel || 'SCORE'}</Text>
                  <Text style={[s.trendScoreSub, { color: P.textFaint }]}>{`today's readiness`}</Text>
                </View>
              </View>
            )}
            <TrendView trend={trend} tint={tint} palette={P} />
          </>
        )}

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1 },

  // Top nav
  topNav: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    marginBottom:      14,
  },
  navBtn: {
    width:           36,
    height:          36,
    alignItems:      'center',
    justifyContent:  'center',
  },
  periodPill: {
    flexDirection: 'row',
    borderRadius:  10,
    borderWidth:   StyleSheet.hairlineWidth,
    padding:       3,
    gap:           1,
  },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical:   6,
    borderRadius:      7,
    alignItems:        'center',
    justifyContent:    'center',
  },
  periodBtnActive: {},
  periodBtnText: {
    fontSize:      13,
    fontWeight:    '700',
    letterSpacing: 0.2,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    marginBottom:      4,
  },
  eyebrow: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1.5,
    marginBottom:  3,
  },
  pageTitle: {
    fontFamily:    'Syne_700Bold',
    fontSize:      36,
    fontWeight:    '800',
    letterSpacing: -1.2,
    lineHeight:    40,
  },

  centered: {
    alignItems:      'center',
    gap:             10,
    paddingVertical: 52,
  },
  emptyCard: {
    marginHorizontal:  20,
    marginTop:         20,
    alignItems:        'center',
    gap:               8,
    paddingVertical:   28,
    paddingHorizontal: 20,
    borderRadius:      18,
    borderWidth:       StyleSheet.hairlineWidth,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptyText:  { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },

  // Gauge
  gaugeWrap:   { alignItems: 'center', marginTop: 2, marginBottom: 0 },
  gaugeCenter: { alignItems: 'center', justifyContent: 'center' },
  gaugeLabel: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 2.4,
    marginBottom:  2,
  },
  gaugeScore: {
    fontFamily:    'Syne_700Bold',
    fontSize:      76,
    fontWeight:    '800',
    letterSpacing: -3,
    lineHeight:    78,
  },
  gaugeOf: {
    fontSize:   12,
    fontWeight: '600',
    marginTop:  2,
  },

  // Insight
  insightWrap: {
    paddingHorizontal: 32,
    marginTop:         8,
    marginBottom:      22,
  },
  insightText: {
    fontSize:   14,
    fontWeight: '500',
    lineHeight: 22,
    textAlign:  'center',
  },
  insightBold: {
    fontSize:   14,
    fontWeight: '800',
  },

  // Metrics
  metricsRow: {
    flexDirection:     'row',
    gap:               10,
    paddingHorizontal: 20,
    marginBottom:      22,
  },
  chip: {
    flex:              1,
    borderRadius:      16,
    paddingVertical:   14,
    paddingHorizontal: 12,
    borderWidth:       StyleSheet.hairlineWidth,
    gap:               1,
  },
  chipLabel: {
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.2,
    marginBottom:  3,
  },
  chipValueRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           3,
  },
  chipValue: {
    fontFamily:    'Syne_700Bold',
    fontSize:      22,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  chipUnit: {
    fontSize:   11,
    fontWeight: '600',
  },
  chipDelta: {
    fontSize:   11,
    fontWeight: '700',
    marginTop:  2,
  },

  // Factors
  factorsWrap: {
    paddingHorizontal: 20,
    marginBottom:      18,
  },
  factorsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   10,
  },
  factorsTitle: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.6,
  },
  factorsCard: {
    borderRadius: 18,
    borderWidth:  StyleSheet.hairlineWidth,
    overflow:     'hidden',
  },
  factorRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               14,
  },
  factorLeft:  { flex: 1, gap: 8 },
  factorLabel: { fontSize: 14, fontWeight: '700' },
  barTrack: {
    height:       5,
    borderRadius: 3,
    overflow:     'hidden',
  },
  barFill: {
    height:       '100%',
    borderRadius: 3,
  },
  factorRight: {
    alignItems: 'flex-end',
    gap:        2,
    minWidth:   52,
  },
  factorScore: {
    fontFamily:    'Syne_700Bold',
    fontSize:      20,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  factorNote: {
    fontSize:  10,
    fontWeight: '600',
    textAlign: 'right',
  },
  factorDivider: {
    height:     StyleSheet.hairlineWidth,
    marginLeft: 16,
  },

  // CTA
  cta: {
    marginHorizontal:  20,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 18,
    paddingVertical:   18,
    borderRadius:      18,
  },
  ctaLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
  },
  ctaIconWrap: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  ctaEyebrow: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.4,
    color:         'rgba(255,255,255,0.68)',
    marginBottom:  2,
  },
  ctaText: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#ffffff',
  },

  // Trend view
  trendScoreRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    paddingHorizontal: 24,
    marginBottom:      16,
    marginTop:         4,
  },
  trendScoreNum: {
    fontFamily:    'Syne_700Bold',
    fontSize:      64,
    fontWeight:    '800',
    letterSpacing: -3,
    lineHeight:    66,
  },
  trendScoreLabel: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 2,
  },
  trendScoreSub: {
    fontSize:   12,
    fontWeight: '500',
  },
  trendWrap: {
    paddingHorizontal: 20,
    marginBottom:      24,
  },
  trendBars: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:           6,
    marginBottom:  12,
  },
  trendBarCol: {
    flex:       1,
    alignItems: 'center',
    gap:        6,
  },
  trendScore: {
    fontSize:   9,
    fontWeight: '700',
  },
  trendBarTrack: {
    width:          '100%',
    justifyContent: 'flex-end',
  },
  trendBarFill: {
    width:        '100%',
    borderRadius: 5,
  },
  trendDay: {
    fontSize:   10,
    fontWeight: '700',
  },
  trendCaption: {
    fontSize:   11,
    fontWeight: '500',
    textAlign:  'center',
  },
});
