import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {
  GradientCard,
  getCardAccent,
  type CardAccentVariant,
  type GradientCardCorner,
} from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const STAT_GAP = 10;
const STAT_ICON_SIZE = 26;

interface StatConfig {
  variant: CardAccentVariant;
  corner: GradientCardCorner;
  icon: IoniconName;
  label: string;
  value: string;
  suffix?: string;
  subtitle?: string;
  delay: number;
}

export interface ProgressHeadlineStatsProps {
  streak: number;
  consistency: number;
  goalsHit: number;
}

function ProgressStatCard({
  variant,
  corner,
  icon,
  label,
  value,
  suffix,
  subtitle,
  delay,
}: StatConfig) {
  const P = usePalette();
  const accent = getCardAccent(variant, P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  return (
    <GradientCard
      variant={variant}
      palette={palette}
      layout="metric"
      corner={corner}
      delay={delay}
      style={styles.tileCard}
      contentStyle={[styles.tileInner, { borderColor: accent.iconSoft }]}
    >
      <Ionicons name={icon} size={STAT_ICON_SIZE} color={accent.iconBg} />
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: P.text }]}>{value}</Text>
        {suffix ? (
          <Text style={[styles.suffix, { color: accent.iconBg }]}>{suffix}</Text>
        ) : null}
      </View>
      <Text style={[styles.label, { color: P.textFaint }]} numberOfLines={1}>
        {label}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: P.textDim }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </GradientCard>
  );
}

export function ProgressHeadlineStats({
  streak,
  consistency,
  goalsHit,
}: ProgressHeadlineStatsProps) {
  const stats: StatConfig[] = [
    {
      variant: 'calories',
      corner: 'top-left',
      icon: 'flame',
      label: 'Day streak',
      value: String(streak),
      delay: 60,
    },
    {
      variant: 'protein',
      corner: 'top-right',
      icon: 'pulse',
      label: 'Consistency',
      value: String(consistency),
      suffix: '/100',
      delay: 110,
    },
    {
      variant: 'carbs',
      corner: 'bottom-right',
      icon: 'trophy',
      label: 'Goals met',
      value: String(goalsHit),
      suffix: '/7',
      delay: 160,
    },
  ];

  return (
    <View style={styles.row}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.tileWrap}>
          <ProgressStatCard {...stat} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: STAT_GAP,
  },
  tileWrap: {
    flex: 1,
    minWidth: 0,
  },
  tileCard: {
    flex: 1,
    width: '100%',
  },
  tileInner: {
    minHeight: 108,
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'flex-start',
    gap: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  suffix: {
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginTop: -2,
  },
});
