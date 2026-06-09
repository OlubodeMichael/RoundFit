import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { CyclePhaseBar } from '@/components/cycle/CyclePhaseBar';
import { PHASE_META } from '@/components/cycle/cycle-phase-config';
import { GradientCard } from '@/components/ui/GradientCard';
import type { CurrentCycle } from '@/context/cycle-context';
import type { Palette } from '@/lib/log-theme';

export interface CycleHeroCardProps {
  P: Palette;
  barWidth: number;
  isLoading: boolean;
  cycleDay: number | null;
  cycleLength: number;
  current: CurrentCycle | null;
  daysUntilNext: number | null;
  nextPeriodLabel: string | null;
}

export function CycleHeroCard({
  P,
  barWidth,
  isLoading,
  cycleDay,
  cycleLength,
  current,
  daysUntilNext,
  nextPeriodLabel,
}: CycleHeroCardProps) {
  const phaseMeta = current?.phase ? PHASE_META[current.phase] : null;
  const PhaseIcon = phaseMeta?.icon;

  return (
    <GradientCard
      variant="body"
      palette={{ card: P.card, cardEdge: P.cardEdge, isDark: P.isDark }}
      delay={80}
      contentStyle={s.cardInner}
    >
      {isLoading ? (
        <ActivityIndicator color={P.body} size="large" style={s.loader} />
      ) : (
        <>
          <View style={s.topRow}>
            <View style={s.leftCol}>
              <Text style={[s.eyebrow, { color: P.textFaint }]}>CYCLE DAY</Text>
              <View style={s.dayRow}>
                <Text style={[s.dayNum, { color: P.text }]}>
                  {cycleDay ?? '—'}
                </Text>
                <View style={s.dayMeta}>
                  <Text style={[s.dayMetaText, { color: P.textFaint }]}>of</Text>
                  <Text style={[s.dayMetaValue, { color: P.textDim }]}>{cycleLength}</Text>
                </View>
              </View>

              {phaseMeta && PhaseIcon ? (
                <View style={[s.phaseChip, { backgroundColor: `${phaseMeta.color}18` }]}>
                  <PhaseIcon size={13} color={phaseMeta.color} strokeWidth={2.4} />
                  <Text style={[s.phaseLabel, { color: phaseMeta.color }]}>
                    {phaseMeta.label} phase
                  </Text>
                </View>
              ) : (
                <View style={[s.phaseChip, { backgroundColor: P.sunken }]}>
                  <Text style={[s.phaseLabel, { color: P.textFaint }]}>No cycle logged yet</Text>
                </View>
              )}

              {phaseMeta && !current?.phase_insight && (
                <Text style={[s.tip, { color: P.textDim }]}>{phaseMeta.tip}</Text>
              )}
            </View>

            {nextPeriodLabel && daysUntilNext != null && (
              <View style={[s.nextCard, { backgroundColor: P.sunken, borderColor: P.hair }]}>
                <Text style={[s.nextEyebrow, { color: P.textFaint }]}>NEXT PERIOD</Text>
                <Text style={[s.nextDate, { color: P.text }]}>{nextPeriodLabel}</Text>
                <View style={[s.nextPill, { backgroundColor: P.body }]}>
                  <Text style={s.nextPillText}>
                    {daysUntilNext <= 0 ? 'Today' : `${daysUntilNext}d`}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {cycleDay != null && (
            <View style={s.barWrap}>
              <CyclePhaseBar
                cycleDay={cycleDay}
                cycleLength={cycleLength}
                barWidth={barWidth}
                activePhase={current?.phase ?? null}
              />
            </View>
          )}

          {phaseMeta && current?.phase_insight && (
            <View style={[s.insight, { backgroundColor: P.bodySoft, borderColor: P.hair }]}>
              <Sparkles size={14} color={P.body} strokeWidth={2.2} />
              <Text style={[s.insightText, { color: P.textDim }]}>{current.phase_insight}</Text>
            </View>
          )}
        </>
      )}
    </GradientCard>
  );
}

const s = StyleSheet.create({
  cardInner: { padding: 20 },
  loader: { paddingVertical: 36 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  leftCol: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 4 },
  dayRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  dayNum: {
    fontFamily: 'BarlowCondensed_800ExtraBold',
    fontSize: 72,
    lineHeight: 68,
    letterSpacing: -2,
  },
  dayMeta: { paddingBottom: 10, gap: 1 },
  dayMetaText: { fontSize: 12, fontWeight: '600' },
  dayMetaValue: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 18, letterSpacing: -0.3 },
  phaseChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  phaseLabel: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },
  tip: { fontSize: 13, lineHeight: 19, marginTop: 10, maxWidth: '95%' },
  nextCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
    minWidth: 88,
  },
  nextEyebrow: { fontSize: 8, fontWeight: '800', letterSpacing: 1.4 },
  nextDate: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  nextPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 2 },
  nextPillText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  barWrap: { marginTop: 20 },
  insight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
  },
  insightText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 20 },
});
