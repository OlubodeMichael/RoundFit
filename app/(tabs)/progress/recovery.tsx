import React, { useCallback, useState } from 'react';
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
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { RecoveryArcGauge } from '@/components/recovery/RecoveryArcGauge';
import { RecoveryDayMetrics } from '@/components/recovery/RecoveryDayMetrics';
import { RecoveryDaySkeleton } from '@/components/recovery/RecoveryDaySkeleton';
import { RecoveryTrendSkeleton } from '@/components/recovery/RecoveryTrendSkeleton';
import { RecoveryWeeklyTrend } from '@/components/recovery/RecoveryWeeklyTrend';
import { RecoveryMonthlyTrend } from '@/components/recovery/RecoveryMonthlyTrend';
import { useRecovery } from '@/hooks/use-recovery';
import { useHealth } from '@/context/health-context';
import { usePalette } from '@/lib/log-theme';
import { getLocalDateString } from '@/utils/date';

type Period = 'D' | 'W' | 'M';
type P = ReturnType<typeof usePalette>;

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

const SCREEN_PAD   = 20;
const SECTION_GAP  = 20;
const GAUGE_MAX    = 272;
function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WDAYS[d.getDay()].slice(0,3).toUpperCase()} · ${MONTHS[d.getMonth()].toUpperCase()} ${d.getDate()}`;
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
  const trend7d  = display.trend7d;
  const trend30d = display.trend30d;

  const tint = score !== null
    ? score >= 70 ? P.protein : score >= 40 ? P.carbs : P.calories
    : P.protein;

  const gaugeSize  = Math.min(Math.floor(width * 0.68), GAUGE_MAX);
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

        {/* ── No data ─────────────────────────────────────────────── */}
        {period === 'D' && initialized && hasInsufficientData && !isCalculating && (
          <View style={[s.emptyCard, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
            <Ionicons name="analytics-outline" size={22} color={P.textFaint} />
            <Text style={[s.emptyTitle, { color: P.text }]}>Not enough data yet</Text>
            <Text style={[s.emptyText, { color: P.textFaint }]}>
              Log sleep, connect HealthKit, or complete a morning check-in to unlock your readiness score.
            </Text>
          </View>
        )}

        {period === 'D' && isCalculating && (
          <RecoveryDaySkeleton gaugeSize={gaugeSize} />
        )}

        {/* ── D — Day view ────────────────────────────────────────── */}
        {showDayContent && (
          <View style={s.dayContent}>
            <View style={s.gaugeWrap}>
              <RecoveryArcGauge score={score} gaugeLabel={gaugeLabel} tint={tint} size={gaugeSize} />
            </View>

            <View style={s.insightWrap}>
              <Text style={[s.insightText, { color: P.textDim }]}>
                {partA}
                <Text style={[s.insightBold, { color: P.text }]}>{partB}</Text>
                {partC}
              </Text>
            </View>

            <RecoveryDayMetrics
              rhr={rhr}
              hrv={hrv}
              sleepHours={sleep}
              rhrDelta={rhrDiff}
              hrvDelta={hrvDiff}
              sleepScore={sleepScr}
              palette={P}
            />

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

            {planText && (
              <TouchableOpacity
                activeOpacity={0.82}
                style={[s.cta, { backgroundColor: tint }]}
              >
                <View style={s.ctaLeft}>
                  <View style={s.ctaIconWrap}>
                    <Ionicons name="star" size={14} color="#fff" />
                  </View>
                  <View style={s.ctaCopy}>
                    <Text style={s.ctaEyebrow}>TODAY&apos;S PLAN</Text>
                    <Text style={s.ctaText} numberOfLines={1}>{planText}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
            )}
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

  emptyCard: {
    marginHorizontal:  SCREEN_PAD,
    marginTop:         SECTION_GAP,
    alignItems:        'center',
    gap:               8,
    paddingVertical:   24,
    paddingHorizontal: SCREEN_PAD,
    borderRadius:      16,
    borderWidth:       StyleSheet.hairlineWidth,
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

  insightWrap: {
    paddingHorizontal: SCREEN_PAD + 8,
  },
  insightText: {
    fontSize:   14,
    fontWeight: '500',
    lineHeight: 21,
    textAlign:  'center',
  },
  insightBold: {
    fontSize:   14,
    fontWeight: '800',
  },

  factorsWrap: {
    paddingHorizontal: SCREEN_PAD,
    gap:               10,
  },
  factorsHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  factorsTitle: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
  },
  factorsCard: {
    borderRadius: 16,
    borderWidth:  StyleSheet.hairlineWidth,
    overflow:     'hidden',
  },
  factorRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   12,
    gap:               12,
  },
  factorLeft:  { flex: 1, gap: 6 },
  factorLabel: { fontSize: 13, fontWeight: '700' },
  barTrack: {
    height:       4,
    borderRadius: 2,
    overflow:     'hidden',
  },
  barFill: {
    height:       '100%',
    borderRadius: 2,
  },
  factorRight: {
    alignItems: 'flex-end',
    gap:        1,
    minWidth:   48,
  },
  factorScore: {
    fontFamily:    'Syne_700Bold',
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.5,
  },
  factorNote: {
    fontSize:   10,
    fontWeight: '600',
    textAlign:  'right',
  },
  factorDivider: {
    height:     StyleSheet.hairlineWidth,
    marginLeft: 14,
  },

  cta: {
    marginHorizontal:  SCREEN_PAD,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderRadius:      16,
    gap:               12,
  },
  ctaLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    minWidth:      0,
  },
  ctaCopy: {
    flex: 1,
    gap:  2,
    minWidth: 0,
  },
  ctaIconWrap: {
    width:           30,
    height:          30,
    borderRadius:    9,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  ctaEyebrow: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
    color:         'rgba(255,255,255,0.68)',
  },
  ctaText: {
    fontSize:   14,
    fontWeight: '700',
    color:      '#ffffff',
  },

});
