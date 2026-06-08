import { StyleSheet, Text, View } from 'react-native';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

export interface FoodLogCaloriesCardProps {
  remaining: number;
  totalCalories: number;
  mealGoal: number;
  eatenPct: number;
  isToday: boolean;
  delay?: number;
}

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
    <View style={styles.statCol}>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export function FoodLogCaloriesCard({
  remaining,
  totalCalories,
  mealGoal,
  eatenPct,
  isToday,
  delay = 80,
}: FoodLogCaloriesCardProps) {
  const P = usePalette();
  const accent = getCardAccent('calories', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const pct = Math.round(Math.min(Math.max(eatenPct, 0), 1) * 100);
  const progressWidth = `${pct}%` as `${number}%`;

  return (
    <GradientCard
      variant="calories"
      palette={palette}
      layout="full"
      corner="top-right"
      delay={delay}
      style={styles.card}
      contentStyle={[styles.inner, { borderColor: accent.iconSoft }]}
    >
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text style={[styles.eyebrow, { color: P.textFaint }]}>
            Calories remaining
          </Text>
          <Text style={[styles.heroValue, { color: P.text }]}>
            {Math.max(0, remaining).toLocaleString()}
          </Text>
          <Text style={[styles.heroUnit, { color: accent.iconBg }]}>kcal left</Text>
        </View>
        <View style={styles.goalMeta}>
          <Text style={[styles.pillValue, { color: accent.iconBg }]}>{pct}%</Text>
          <Text style={[styles.pillLabel, { color: P.textFaint }]}>of goal</Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: P.sunken }]}>
        <View
          style={[
            styles.fill,
            { width: progressWidth, backgroundColor: accent.iconBg },
          ]}
        />
      </View>

      <View style={[styles.foot, { borderTopColor: P.hair }]}>
        <StatColumn
          label={isToday ? 'EATEN' : 'ATE'}
          value={totalCalories.toLocaleString()}
          valueColor={P.text}
          labelColor={P.textFaint}
        />
        <View style={[styles.vDiv, { backgroundColor: P.hair }]} />
        <StatColumn
          label="REMAINING"
          value={Math.max(0, remaining).toLocaleString()}
          valueColor={P.sage}
          labelColor={P.textFaint}
        />
        <View style={[styles.vDiv, { backgroundColor: P.hair }]} />
        <StatColumn
          label="GOAL"
          value={mealGoal.toLocaleString()}
          valueColor={P.textDim}
          labelColor={P.textFaint}
        />
      </View>
    </GradientCard>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  inner: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.6,
    lineHeight: 46,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  goalMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    minWidth: 56,
  },
  pillValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  pillLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
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
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
});
