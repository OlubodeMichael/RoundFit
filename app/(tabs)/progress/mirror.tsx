import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import {
  AnimatedCard,
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Dummy data ─────────────────────────────────────────────────────────────
const DATE_RANGE   = 'Mar 19 — Apr 18';
const OPTIMAL_SLEEP   = { hours: 7, minutes: 25, note: 'Bedtime 10:40 PM, wake 6:05 AM' };
const OPTIMAL_PROTEIN = { grams: 142, note: 'Around 1.7g per kg bodyweight' };

const TRAINING = {
  best:  { day: 'Tuesday',  score: 92, reason: 'Full night sleep + carbs above 180g'   },
  worst: { day: 'Sunday',   score: 51, reason: 'Sleep under 6h after Saturday late night' },
};

type CorrelationTint = 'protein' | 'sleep' | 'workout' | 'fat' | 'calories';
type Correlation = {
  label:      string;
  icon:       IoniconName;
  tint:       CorrelationTint;
  strength:   number;
  direction:  'positive' | 'negative';
};
const CORRELATIONS: Correlation[] = [
  { label: 'Sleep ≥ 7h → next-day energy',  icon: 'moon',    tint: 'sleep',   strength: 0.82, direction: 'positive' },
  { label: 'Protein ≥ 140g → recovery',     icon: 'fitness', tint: 'protein', strength: 0.74, direction: 'positive' },
  { label: 'Late dinner → morning mood',    icon: 'time',    tint: 'fat',     strength: 0.61, direction: 'negative' },
  { label: 'Hydration → afternoon focus',   icon: 'water',   tint: 'calories',strength: 0.54, direction: 'positive' },
];
const STRONGEST = CORRELATIONS[0];

const IMPROVEMENTS = [
  { metric: 'Consistency', from: 62, to: 84, unit: '/100' },
  { metric: 'Avg protein', from: 98, to: 128, unit: ' g' },
  { metric: 'Sleep',       from: 6.1, to: 7.0, unit: ' h' },
  { metric: 'Day streak',  from: 3,  to: 12,  unit: ' d' },
];

const BIGGEST_IMPROVEMENT = IMPROVEMENTS[3]; // streak

const AI_SYNTHESIS =
  'Your body responds best to a consistent 7:30 AM wake. When you protect that, everything else compounds — energy lifts, protein lands naturally, and your training days get easier.';

export default function MirrorScreen() {
  const P      = usePalette();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Premium report"
          title="30-day mirror"
          accent={P.fat}
          right={
            <Pressable hitSlop={10} style={[styles.shareBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <Ionicons name="share-outline" size={18} color={P.text} />
            </Pressable>
          }
        />

        <View style={styles.stack}>
          {/* ── Date range pill ────────────────────────────────── */}
          <View style={styles.rangeHead}>
            <View style={[styles.rangePill, { backgroundColor: P.fatSoft }]}>
              <Ionicons name="calendar" size={11} color={P.fat} />
              <Text style={[styles.rangeText, { color: P.fat }]}>{DATE_RANGE.toUpperCase()}</Text>
            </View>
            <View style={[styles.aiBadge, { backgroundColor: P.fatSoft }]}>
              <Ionicons name="sparkles" size={10} color={P.fat} />
              <Text style={[styles.aiBadgeText, { color: P.fat }]}>CLAUDE</Text>
            </View>
          </View>

          {/* ── AI synthesis quote ─────────────────────────────── */}
          <AnimatedCard delay={60} style={{ overflow: 'hidden' }}>
            <View pointerEvents="none" style={[styles.glow, { backgroundColor: P.fatSoft, top: -80, right: -80 }]} />
            <Text style={[styles.quoteMark, { color: P.fat }]}>"</Text>
            <Text style={[styles.quoteBody, { color: P.text }]}>{AI_SYNTHESIS}</Text>
            <Text style={[styles.quoteAttrib, { color: P.textFaint }]}>
              — Synthesised from 30 days of logs, check-ins, and wearables
            </Text>
          </AnimatedCard>

          {/* ── Optimal sleep + protein ────────────────────────── */}
          <View style={styles.optimalRow}>
            <AnimatedCard delay={120} padding={18} style={styles.optimalCard}>
              <View style={[styles.iconTile, { backgroundColor: P.sleepSoft }]}>
                <Ionicons name="moon" size={16} color={P.sleep} />
              </View>
              <Text style={[styles.optimalLabel, { color: P.textFaint }]}>OPTIMAL SLEEP</Text>
              <Text style={[styles.optimalValue, { color: P.text }]}>
                {OPTIMAL_SLEEP.hours}
                <Text style={[styles.optimalUnit, { color: P.textFaint }]}>h </Text>
                {OPTIMAL_SLEEP.minutes}
                <Text style={[styles.optimalUnit, { color: P.textFaint }]}>m</Text>
              </Text>
              <Text style={[styles.optimalNote, { color: P.textDim }]}>
                {OPTIMAL_SLEEP.note}
              </Text>
            </AnimatedCard>

            <AnimatedCard delay={160} padding={18} style={styles.optimalCard}>
              <View style={[styles.iconTile, { backgroundColor: P.proteinSoft }]}>
                <Ionicons name="fitness" size={16} color={P.protein} />
              </View>
              <Text style={[styles.optimalLabel, { color: P.textFaint }]}>OPTIMAL PROTEIN</Text>
              <Text style={[styles.optimalValue, { color: P.text }]}>
                {OPTIMAL_PROTEIN.grams}
                <Text style={[styles.optimalUnit, { color: P.textFaint }]}>g</Text>
              </Text>
              <Text style={[styles.optimalNote, { color: P.textDim }]}>
                {OPTIMAL_PROTEIN.note}
              </Text>
            </AnimatedCard>
          </View>

          {/* ── Training: best vs worst ────────────────────────── */}
          <AnimatedCard delay={220}>
            <Text style={[styles.cardTitle, { color: P.text }]}>Training days</Text>
            <Text style={[styles.cardSub, { color: P.textFaint }]}>
              Across 30 days of logged workouts
            </Text>

            <View style={{ marginTop: 14 }}>
              <TrainingRow
                variant="best"
                day={TRAINING.best.day}
                score={TRAINING.best.score}
                reason={TRAINING.best.reason}
              />
              <View style={[styles.trainDivider, { backgroundColor: P.hair }]} />
              <TrainingRow
                variant="worst"
                day={TRAINING.worst.day}
                score={TRAINING.worst.score}
                reason={TRAINING.worst.reason}
              />
            </View>
          </AnimatedCard>

          {/* ── Strongest correlation ──────────────────────────── */}
          <AnimatedCard delay={280}>
            <View style={styles.correlHead}>
              <View style={[styles.iconTile, { backgroundColor: P.sleepSoft }]}>
                <Ionicons name="git-network" size={16} color={P.sleep} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.miniLabel, { color: P.sleep }]}>STRONGEST CORRELATION</Text>
                <Text style={[styles.correlMeta, { color: P.textFaint }]}>
                  {Math.round(STRONGEST.strength * 100)}% confidence · 30-day window
                </Text>
              </View>
            </View>

            <Text style={[styles.correlTitle, { color: P.text }]}>
              {STRONGEST.label}
            </Text>

            <View style={[styles.strengthTrack, { backgroundColor: P.sunken }]}>
              <View
                style={[
                  styles.strengthFill,
                  { width: `${STRONGEST.strength * 100}%`, backgroundColor: P.sleep },
                ]}
              />
            </View>

            <Text style={[styles.correlCaption, { color: P.textFaint }]}>
              Based on 30 days, {CORRELATIONS.length} confirmed correlations
            </Text>

            <View style={{ marginTop: 14, gap: 10 }}>
              {CORRELATIONS.map((c, i) => {
                const tint = P[c.tint];
                const soft = P[`${c.tint}Soft` as keyof ReturnType<typeof usePalette>] as string;
                return (
                  <View key={i} style={styles.correlRow}>
                    <View style={[styles.correlIcon, { backgroundColor: soft }]}>
                      <Ionicons name={c.icon} size={12} color={tint} />
                    </View>
                    <Text style={[styles.correlRowLabel, { color: P.text }]} numberOfLines={1}>
                      {c.label}
                    </Text>
                    <View style={[styles.correlBar, { backgroundColor: P.sunken }]}>
                      <View
                        style={{
                          width:           `${c.strength * 100}%`,
                          height:          '100%',
                          backgroundColor: tint,
                          opacity:         c.direction === 'negative' ? 0.5 : 1,
                          borderRadius:    3,
                        }}
                      />
                    </View>
                    <Text style={[styles.correlPct, { color: P.textDim }]}>
                      {Math.round(c.strength * 100)}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </AnimatedCard>

          {/* ── Biggest improvement ────────────────────────────── */}
          <AnimatedCard delay={340} style={{ overflow: 'hidden' }}>
            <View pointerEvents="none" style={[styles.glow, { backgroundColor: P.proteinSoft, top: -60, right: -60 }]} />

            <View style={styles.improveHead}>
              <View style={[styles.iconTile, { backgroundColor: P.proteinSoft }]}>
                <Ionicons name="trophy" size={16} color={P.protein} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.miniLabel, { color: P.protein }]}>BIGGEST IMPROVEMENT</Text>
                <Text style={[styles.improveMeta, { color: P.textFaint }]}>vs. previous 30-day window</Text>
              </View>
            </View>

            <View style={styles.improveBigRow}>
              <Text style={[styles.improveTitle, { color: P.text }]}>{BIGGEST_IMPROVEMENT.metric}</Text>
              <View style={styles.improveDeltaBlock}>
                <Text style={[styles.improveFrom, { color: P.textFaint }]}>
                  {BIGGEST_IMPROVEMENT.from}{BIGGEST_IMPROVEMENT.unit}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={P.textFaint} />
                <Text style={[styles.improveTo, { color: P.protein }]}>
                  {BIGGEST_IMPROVEMENT.to}{BIGGEST_IMPROVEMENT.unit}
                </Text>
              </View>
            </View>

            {/* mini grid of other improvements */}
            <View style={styles.improveGrid}>
              {IMPROVEMENTS.filter(m => m.metric !== BIGGEST_IMPROVEMENT.metric).map((m, i) => (
                <View
                  key={m.metric}
                  style={[
                    styles.improveCell,
                    { borderColor: P.hair },
                    i < 2 && styles.improveCellBottomBorder,
                    i % 2 === 0 && styles.improveCellRightBorder,
                  ]}
                >
                  <Text style={[styles.improveCellLabel, { color: P.textFaint }]}>
                    {m.metric.toUpperCase()}
                  </Text>
                  <View style={styles.improveCellRow}>
                    <Text style={[styles.improveCellFrom, { color: P.textFaint }]}>
                      {m.from}
                    </Text>
                    <Ionicons name="arrow-forward" size={10} color={P.textFaint} />
                    <Text style={[styles.improveCellTo, { color: P.text }]}>
                      {m.to}
                      <Text style={{ color: P.textFaint, fontSize: 11 }}>{m.unit}</Text>
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </AnimatedCard>

          {/* ── Share + save ───────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable style={({ pressed }) => [
              styles.secondaryCta,
              { borderColor: P.cardEdge, backgroundColor: P.card },
              pressed && { opacity: 0.85 },
            ]}>
              <Ionicons name="bookmark-outline" size={16} color={P.text} />
              <Text style={[styles.secondaryCtaText, { color: P.text }]}>Save</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [
              styles.primaryCta,
              { backgroundColor: P.fat },
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
            ]}>
              <Ionicons name="share-outline" size={16} color="#fff" />
              <Text style={styles.primaryCtaText}>Share mirror</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function TrainingRow({
  variant, day, score, reason,
}: {
  variant: 'best' | 'worst';
  day:     string;
  score:   number;
  reason:  string;
}) {
  const P     = usePalette();
  const color = variant === 'best' ? P.protein : P.danger;
  const soft  = variant === 'best' ? P.proteinSoft : P.dangerSoft;

  return (
    <View style={styles.trainRow}>
      <View style={[styles.trainTile, { backgroundColor: soft }]}>
        <Ionicons
          name={variant === 'best' ? 'trending-up' : 'trending-down'}
          size={16}
          color={color}
        />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.trainTopLine, { color: P.textFaint }]}>
          {variant === 'best' ? 'BEST DAY' : 'WORST DAY'}
        </Text>
        <Text style={[styles.trainDay, { color: P.text }]}>{day}</Text>
        <Text style={[styles.trainReason, { color: P.textDim }]} numberOfLines={2}>
          {reason}
        </Text>
      </View>
      <Text style={[styles.trainScore, { color }]}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    paddingHorizontal: 20,
    gap:               14,
  },

  shareBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems:     'center',
    justifyContent: 'center',
    borderWidth:    StyleSheet.hairlineWidth,
  },

  glow: {
    position:     'absolute',
    width:        240,
    height:       240,
    borderRadius: 120,
  },

  rangeHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  rangePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
  },
  rangeText: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },
  aiBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      8,
    marginLeft:        'auto',
  },
  aiBadgeText: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 0.6,
  },

  // ─── Quote ──
  quoteMark: {
    fontSize:      56,
    fontWeight:    '800',
    lineHeight:    52,
    marginTop:     -10,
    marginBottom:  -18,
  },
  quoteBody: {
    fontSize:      17,
    fontWeight:    '600',
    letterSpacing: -0.3,
    lineHeight:    25,
    marginTop:     14,
  },
  quoteAttrib: {
    fontSize:   11,
    fontWeight: '500',
    marginTop:  14,
    lineHeight: 16,
  },

  // ─── Optimal row ──
  optimalRow: {
    flexDirection: 'row',
    gap:           10,
  },
  optimalCard: {
    flex: 1,
    gap:  8,
  },
  iconTile: {
    width: 36, height: 36, borderRadius: 12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  optimalLabel: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
    marginTop:     2,
  },
  optimalValue: {
    fontSize:      28,
    fontWeight:    '800',
    letterSpacing: -1.0,
  },
  optimalUnit: {
    fontSize:   14,
    fontWeight: '600',
  },
  optimalNote: {
    fontSize:   11,
    fontWeight: '500',
    lineHeight: 16,
  },

  // ─── Training ──
  cardTitle: {
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: -0.4,
    marginBottom:  2,
  },
  cardSub: {
    fontSize:   11,
    fontWeight: '500',
  },
  trainRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
    paddingVertical: 14,
  },
  trainTile: {
    width: 40, height: 40, borderRadius: 12,
    alignItems:     'center',
    justifyContent: 'center',
  },
  trainTopLine: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },
  trainDay: {
    fontSize:      16,
    fontWeight:    '800',
    letterSpacing: -0.4,
  },
  trainReason: {
    fontSize:   12,
    fontWeight: '500',
    lineHeight: 17,
  },
  trainScore: {
    fontSize:      32,
    fontWeight:    '800',
    letterSpacing: -1.2,
  },
  trainDivider: {
    height:     StyleSheet.hairlineWidth,
    marginLeft: 54,
  },

  // ─── Correlations ──
  correlHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  12,
  },
  miniLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  correlMeta: {
    fontSize:   11,
    fontWeight: '500',
  },
  correlTitle: {
    fontSize:      16,
    fontWeight:    '700',
    letterSpacing: -0.3,
    lineHeight:    22,
    marginBottom:  12,
  },
  strengthTrack: {
    height:       6,
    borderRadius: 4,
    overflow:     'hidden',
    marginBottom: 10,
  },
  strengthFill: {
    height:       '100%',
    borderRadius: 4,
  },
  correlCaption: {
    fontSize:   11,
    fontWeight: '500',
  },
  correlRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  correlIcon: {
    width: 22, height: 22, borderRadius: 7,
    alignItems:     'center',
    justifyContent: 'center',
  },
  correlRowLabel: {
    flex:       1,
    fontSize:   12,
    fontWeight: '600',
  },
  correlBar: {
    width:        70,
    height:       4,
    borderRadius: 3,
    overflow:     'hidden',
  },
  correlPct: {
    fontSize:   10,
    fontWeight: '800',
    width:      26,
    textAlign:  'right',
  },

  // ─── Improvements ──
  improveHead: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    marginBottom:  14,
  },
  improveMeta: {
    fontSize:   11,
    fontWeight: '500',
    marginTop:  1,
  },
  improveBigRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  16,
  },
  improveTitle: {
    flex:          1,
    fontSize:      24,
    fontWeight:    '800',
    letterSpacing: -0.7,
  },
  improveDeltaBlock: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  improveFrom: {
    fontSize:      14,
    fontWeight:    '600',
    textDecorationLine: 'line-through',
  },
  improveTo: {
    fontSize:      20,
    fontWeight:    '800',
    letterSpacing: -0.4,
  },

  improveGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
  },
  improveCell: {
    width:          '50%',
    padding:        12,
    gap:            5,
  },
  improveCellBottomBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  improveCellRightBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  improveCellLabel: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.0,
  },
  improveCellRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           5,
  },
  improveCellFrom: {
    fontSize:      12,
    fontWeight:    '600',
    textDecorationLine: 'line-through',
  },
  improveCellTo: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.4,
  },

  // ─── CTAs ──
  primaryCta: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    paddingVertical: 16,
    borderRadius:    16,
  },
  primaryCtaText: {
    color:         '#fff',
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
  secondaryCta: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    paddingVertical: 16,
    paddingHorizontal:20,
    borderRadius:    16,
    borderWidth:     StyleSheet.hairlineWidth,
  },
  secondaryCtaText: {
    fontSize:      14,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
});
