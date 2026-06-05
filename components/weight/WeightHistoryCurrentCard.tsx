import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { WeightTrendChart } from '@/components/weight/WeightTrendChart';
import type { WeightEntry } from '@/context/weight-context';
import { usePalette } from '@/lib/log-theme';

const DELTA_THRESHOLD_KG = 0.1;
const HEADER_ICON_SIZE = 26;

function StatColumn({
  label,
  value,
  valueColor,
  labelColor,
}: {
  label: string;
  value: string;
  valueColor: string;
  labelColor: string;
}) {
  return (
    <View style={s.statCol}>
      <Text style={[s.statLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[s.statValue, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export interface WeightHistoryCurrentCardProps {
  entries: WeightEntry[];
  currentKg: number | null;
  startingKg: number | null;
  deltaKg: number;
  weightUnit: string;
  toDisplayWeight: (kg: number) => number;
  delay?: number;
}

export function WeightHistoryCurrentCard({
  entries,
  currentKg,
  startingKg,
  deltaKg,
  weightUnit,
  toDisplayWeight,
  delay = 60,
}: WeightHistoryCurrentCardProps) {
  const P = usePalette();
  const accent = getCardAccent('weight', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  const currentDisplay =
    currentKg !== null ? toDisplayWeight(currentKg).toFixed(1) : '—';
  const startingDisplay =
    startingKg !== null ? toDisplayWeight(startingKg).toFixed(1) : '—';
  const deltaDisplay = toDisplayWeight(Math.abs(deltaKg)).toFixed(1);
  const showDeltaPill = entries.length >= 2;
  const isDown = deltaKg <= -DELTA_THRESHOLD_KG;
  const isUp = deltaKg >= DELTA_THRESHOLD_KG;
  const deltaColor = isDown ? P.protein : isUp ? P.calories : P.textFaint;
  const deltaSoft = isDown ? P.proteinSoft : isUp ? P.caloriesSoft : P.sunken;
  const changeTone =
    deltaKg < -DELTA_THRESHOLD_KG
      ? P.protein
      : deltaKg > DELTA_THRESHOLD_KG
        ? P.calories
        : P.text;

  if (entries.length === 0) {
    return (
      <GradientCard
        variant="weight"
        palette={palette}
        corner="top-right"
        delay={delay}
        contentStyle={[s.shell, { borderColor: accent.iconSoft }]}
      >
        <View style={s.header}>
          <View style={s.headerMain}>
            <Ionicons name="scale" size={HEADER_ICON_SIZE} color={accent.iconBg} />
            <View style={s.headerCopy}>
              <Text style={[s.headerLabel, { color: P.textDim }]}>Current</Text>
              <Text style={[s.headerMeta, { color: P.text }]}>No entries yet</Text>
            </View>
          </View>
        </View>
        <View style={s.emptyBlock}>
          {currentKg !== null && (
            <Text style={[s.emptyMeta, { color: P.textFaint }]}>
              Profile weight: {currentDisplay} {weightUnit}
            </Text>
          )}
          <Text style={[s.emptyNote, { color: P.textFaint }]}>
            Log your weight regularly to track your progress over time.
          </Text>
        </View>
      </GradientCard>
    );
  }

  return (
    <GradientCard
      variant="weight"
      palette={palette}
      corner="top-right"
      delay={delay}
      contentStyle={[s.shell, { borderColor: accent.iconSoft }]}
    >
      <View style={s.header}>
        <View style={s.headerMain}>
          <Ionicons name="scale" size={HEADER_ICON_SIZE} color={accent.iconBg} />
          <View style={s.headerCopy}>
            <Text style={[s.headerLabel, { color: P.textDim }]}>Current</Text>
            <Text style={[s.headerMeta, { color: P.text }]}>
              {currentDisplay}
              <Text style={[s.headerUnit, { color: accent.iconBg }]}>
                {' '}
                {weightUnit}
              </Text>
            </Text>
          </View>
        </View>
        {showDeltaPill && (
          <View style={[s.trendPill, { backgroundColor: deltaSoft }]}>
            <Ionicons
              name={isDown ? 'trending-down' : isUp ? 'trending-up' : 'remove'}
              size={11}
              color={deltaColor}
            />
            <Text style={[s.trendText, { color: deltaColor }]}>
              {deltaKg > 0 ? '+' : deltaKg < 0 ? '-' : ''}
              {deltaDisplay} {weightUnit}
            </Text>
          </View>
        )}
      </View>

      <WeightTrendChart
        entries={entries}
        accent={accent.iconBg}
        palette={P}
      />

      <View style={[s.foot, { borderTopColor: P.hair }]}>
        <StatColumn
          label="STARTING"
          value={`${startingDisplay} ${weightUnit}`}
          valueColor={P.text}
          labelColor={P.textFaint}
        />
        <View style={[s.vDiv, { backgroundColor: P.hair }]} />
        <StatColumn
          label="CURRENT"
          value={`${currentDisplay} ${weightUnit}`}
          valueColor={accent.iconBg}
          labelColor={P.textFaint}
        />
        <View style={[s.vDiv, { backgroundColor: P.hair }]} />
        <StatColumn
          label="CHANGE"
          value={`${deltaKg > 0 ? '+' : deltaKg < 0 ? '-' : ''}${deltaDisplay} ${weightUnit}`}
          valueColor={changeTone}
          labelColor={P.textFaint}
        />
      </View>
    </GradientCard>
  );
}

const s = StyleSheet.create({
  shell: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  headerCopy: { flex: 1, gap: 3, minWidth: 0 },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  headerMeta: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  headerUnit: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  emptyBlock: { gap: 8, paddingBottom: 4 },
  emptyMeta: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyNote: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    textAlign: 'center',
  },
  foot: {
    flexDirection: 'row',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  vDiv: { width: StyleSheet.hairlineWidth },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.35,
    fontVariant: ['tabular-nums'],
  },
});
