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

import { MirrorSectionHeader } from '@/components/progress/MirrorSectionHeader';
import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import type { CardAccent } from '@/components/ui/gradient-card-theme';
import type { CardAccentVariant } from '@/components/ui/gradient-card-theme';
import { Redirect } from 'expo-router';
import {
  ScreenHeader,
  usePalette,
  useScreenPadding,
} from '@/lib/log-theme';
import { MIRROR_ENABLED } from '@/constants/features';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Dummy data ─────────────────────────────────────────────────────────────
const DATE_RANGE   = 'Mar 19 - Apr 18';
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
  'Your body responds best to a consistent 7:30 AM wake. When you protect that, everything else compounds: energy lifts, protein lands naturally, and your training days get easier.';

const CARD_PAD = { paddingHorizontal: 16, paddingBottom: 16 };

export default function MirrorScreen() {
  // Held back from launch. The screen is intact but must not be reachable —
  // including by deep link or a typed-route jump, which the entry-point gate
  // alone does not cover. See MIRROR_PLAN.md.
  if (!MIRROR_ENABLED) return <Redirect href="/(tabs)/progress" />;

  const P      = usePalette();
  const pad    = useScreenPadding();
  const insets = useSafeAreaInsets();
  const cardPalette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const insightAccent = getCardAccent('insight', P.isDark);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: pad.paddingTop, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Premium report"
          title="30-day mirror"
          accent={insightAccent.iconBg}
          right={
            <Pressable hitSlop={10} style={[styles.shareBtn, { backgroundColor: P.card, borderColor: P.cardEdge }]}>
              <Ionicons name="share-outline" size={18} color={P.text} />
            </Pressable>
          }
        />

        <View style={styles.stack}>
          <View style={styles.rangeHead}>
            <View style={[styles.rangePill, { backgroundColor: insightAccent.iconSoft }]}>
              <Ionicons name="calendar-outline" size={12} color={insightAccent.iconBg} />
              <Text style={[styles.rangeText, { color: insightAccent.iconBg }]}>
                {DATE_RANGE.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.rangePill, { backgroundColor: insightAccent.iconSoft }]}>
              <Ionicons name="sparkles" size={12} color={insightAccent.iconBg} />
              <Text style={[styles.rangeText, { color: insightAccent.iconBg }]}>RIS</Text>
            </View>
          </View>

          <GradientCard
            variant="insight"
            palette={cardPalette}
            corner="top-right"
            delay={60}
          >
            <View style={[CARD_PAD, { paddingTop: 16 }]}>
              <MirrorSectionHeader
                accent={insightAccent}
                icon="sparkles"
                label="AI synthesis"
                meta="RoundFit Intelligence Score"
                textDim={P.textDim}
                textFaint={P.textFaint}
              />
              <Text style={[styles.quoteBody, { color: P.text }]}>{AI_SYNTHESIS}</Text>
              <Text style={[styles.quoteAttrib, { color: P.textFaint }]}>
                Based on 30 days of logs, check-ins, and wearables
              </Text>
            </View>
          </GradientCard>

          <View style={styles.optimalRow}>
            <OptimalMetricCard
              cardVariant="insight"
              accent={{
                ...getCardAccent('insight', P.isDark),
                iconBg: P.sleep,
                iconSoft: P.sleepSoft,
              }}
              icon="moon-outline"
              palette={cardPalette}
              delay={120}
              label="Optimal sleep"
              value={`${OPTIMAL_SLEEP.hours}h ${OPTIMAL_SLEEP.minutes}m`}
              note={OPTIMAL_SLEEP.note}
              P={P}
            />
            <OptimalMetricCard
              cardVariant="protein"
              palette={cardPalette}
              delay={160}
              label="Optimal protein"
              value={`${OPTIMAL_PROTEIN.grams}g`}
              note={OPTIMAL_PROTEIN.note}
              P={P}
            />
          </View>

          <GradientCard variant="workouts" palette={cardPalette} delay={220}>
            <View style={[CARD_PAD, { paddingTop: 16 }]}>
              <MirrorSectionHeader
                accent={getCardAccent('workouts', P.isDark)}
                icon="barbell-outline"
                label="Training days"
                meta="Across 30 days of logged workouts"
                textDim={P.textDim}
                textFaint={P.textFaint}
              />
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
          </GradientCard>

          <GradientCard variant="insight" palette={cardPalette} delay={280}>
            <View style={[CARD_PAD, { paddingTop: 16 }]}>
              <MirrorSectionHeader
                accent={{
                  ...getCardAccent('insight', P.isDark),
                  iconBg: P.sleep,
                  iconSoft: P.sleepSoft,
                }}
                icon="git-network-outline"
                label="Strongest correlation"
                meta={`${Math.round(STRONGEST.strength * 100)}% confidence · 30-day window`}
                textDim={P.textDim}
                textFaint={P.textFaint}
              />
              <Text style={[styles.correlTitle, { color: P.text }]}>
                {STRONGEST.label}
              </Text>
              <View style={[styles.strengthTrack, { backgroundColor: P.hair }]}>
                <View
                  style={[
                    styles.strengthFill,
                    {
                      width: `${STRONGEST.strength * 100}%`,
                      backgroundColor: P.sleep,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.correlCaption, { color: P.textFaint }]}>
                Analysed by RIS · {CORRELATIONS.length} confirmed correlations
              </Text>
              <View style={{ marginTop: 14, gap: 10 }}>
                {CORRELATIONS.map((c, i) => {
                  const tint = P[c.tint];
                  const soft = P[`${c.tint}Soft` as keyof typeof P] as string;
                  return (
                    <View key={i} style={styles.correlRow}>
                      <View style={[styles.correlIcon, { backgroundColor: soft }]}>
                        <Ionicons name={c.icon} size={12} color={tint} />
                      </View>
                      <Text
                        style={[styles.correlRowLabel, { color: P.text }]}
                        numberOfLines={1}
                      >
                        {c.label}
                      </Text>
                      <View style={[styles.correlBar, { backgroundColor: P.hair }]}>
                        <View
                          style={{
                            width: `${c.strength * 100}%`,
                            height: '100%',
                            backgroundColor: tint,
                            opacity: c.direction === 'negative' ? 0.5 : 1,
                            borderRadius: 3,
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
            </View>
          </GradientCard>

          <GradientCard variant="protein" palette={cardPalette} delay={340}>
            <View style={[CARD_PAD, { paddingTop: 16 }]}>
              <MirrorSectionHeader
                accent={getCardAccent('protein', P.isDark)}
                icon="trophy-outline"
                label="Biggest improvement"
                meta="vs. previous 30-day window"
                textDim={P.textDim}
                textFaint={P.textFaint}
              />
              <View style={styles.improveBigRow}>
                <Text style={[styles.improveTitle, { color: P.text }]}>
                  {BIGGEST_IMPROVEMENT.metric}
                </Text>
                <View style={styles.improveDeltaBlock}>
                  <Text style={[styles.improveFrom, { color: P.textFaint }]}>
                    {BIGGEST_IMPROVEMENT.from}
                    {BIGGEST_IMPROVEMENT.unit}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={P.textFaint} />
                  <Text style={[styles.improveTo, { color: P.protein }]}>
                    {BIGGEST_IMPROVEMENT.to}
                    {BIGGEST_IMPROVEMENT.unit}
                  </Text>
                </View>
              </View>
              <View style={[styles.improveGrid, { borderColor: P.hair }]}>
                {IMPROVEMENTS.filter((m) => m.metric !== BIGGEST_IMPROVEMENT.metric).map(
                  (m, i) => (
                    <View
                      key={m.metric}
                      style={[
                        styles.improveCell,
                        i < 2 && styles.improveCellBottomBorder,
                        i % 2 === 0 && styles.improveCellRightBorder,
                        { borderColor: P.hair },
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
                          <Text style={{ color: P.textFaint, fontSize: 11 }}>
                            {m.unit}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  ),
                )}
              </View>
            </View>
          </GradientCard>

          <View style={styles.ctaRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryCta,
                { borderColor: P.cardEdge, backgroundColor: P.card },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="bookmark-outline" size={16} color={P.text} />
              <Text style={[styles.secondaryCtaText, { color: P.text }]}>Save</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.primaryCta,
                { backgroundColor: insightAccent.iconBg },
                pressed && { opacity: 0.92 },
              ]}
            >
              <Ionicons name="share-outline" size={16} color="#fff" />
              <Text style={styles.primaryCtaText}>Share mirror</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function OptimalMetricCard({
  cardVariant,
  accent: accentProp,
  icon: iconProp,
  palette,
  delay,
  label,
  value,
  note,
  P,
}: {
  cardVariant: CardAccentVariant;
  accent?: CardAccent;
  icon?: IoniconName;
  palette: { card: string; cardEdge: string; isDark: boolean };
  delay: number;
  label: string;
  value: string;
  note: string;
  P: ReturnType<typeof usePalette>;
}) {
  const accent = accentProp ?? getCardAccent(cardVariant, P.isDark);
  const icon: IoniconName =
    iconProp ?? (cardVariant === 'protein' ? 'nutrition-outline' : 'sparkles');

  return (
    <GradientCard
      variant={cardVariant}
      palette={palette}
      delay={delay}
      style={styles.optimalCard}
    >
      <View style={[CARD_PAD, { paddingTop: 14 }]}>
        <MirrorSectionHeader
          accent={accent}
          icon={icon}
          label={label}
          textDim={P.textDim}
          textFaint={P.textFaint}
        />
        <Text style={[styles.optimalValue, { color: P.text }]}>{value}</Text>
        <Text style={[styles.optimalNote, { color: P.textDim }]}>{note}</Text>
      </View>
    </GradientCard>
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

  const accent = getCardAccent(variant === 'best' ? 'protein' : 'calories', P.isDark);

  return (
    <View style={styles.trainRow}>
      <View style={[styles.trainIconRing, { backgroundColor: accent.iconSoft }]}>
        <View style={[styles.trainIconBox, { backgroundColor: accent.iconBg }]}>
          <Ionicons
            name={variant === 'best' ? 'trending-up' : 'trending-down'}
            size={16}
            color="#FFF"
          />
        </View>
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

  rangeHead: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           8,
  },
  rangePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      999,
  },
  rangeText: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },

  quoteBody: {
    fontSize:      16,
    fontWeight:    '600',
    letterSpacing: -0.25,
    lineHeight:    24,
    marginTop:     12,
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
    minWidth: 0,
  },
  optimalValue: {
    fontSize:      26,
    fontWeight:    '800',
    letterSpacing: -0.8,
    marginTop:     10,
  },
  optimalNote: {
    fontSize:   12,
    fontWeight: '500',
    lineHeight: 17,
    marginTop:  4,
  },

  trainRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
    paddingVertical: 14,
  },
  trainIconRing: {
    padding: 4,
    borderRadius: 14,
  },
  trainIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
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
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
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
    flexWrap: 'wrap',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
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
