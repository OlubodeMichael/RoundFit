import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const SUMMARY_ICON_SIZE = 28;

export interface LogTodaySummaryMetric {
  icon: IoniconName;
  label: string;
  value: string;
  unit: string;
  variant: 'meals' | 'workouts' | 'water';
}

export interface LogTodaySummaryProps {
  metrics: LogTodaySummaryMetric[];
}

export function LogTodaySummary({ metrics }: LogTodaySummaryProps) {
  const P = usePalette();
  const accent = getCardAccent('macros', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  return (
    <GradientCard
      variant="macros"
      palette={palette}
      layout="full"
      corner="top-right"
      animated={false}
      style={styles.card}
      contentStyle={[styles.inner, { borderColor: accent.iconSoft }]}
    >
      <Text style={[styles.heading, { color: P.textFaint }]}>Today at a glance</Text>
      <View style={styles.row}>
        {metrics.map((metric, index) => {
          const itemAccent = getCardAccent(metric.variant, P.isDark);
          return (
            <View
              key={metric.label}
              style={[
                styles.cell,
                index < metrics.length - 1 && {
                  borderRightWidth: StyleSheet.hairlineWidth,
                  borderRightColor: P.hair,
                },
              ]}
            >
              <Ionicons name={metric.icon} size={SUMMARY_ICON_SIZE} color={itemAccent.iconBg} />
              <Text
                style={[styles.cellValue, { color: P.text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {metric.value}
              </Text>
              <Text style={[styles.cellUnit, { color: itemAccent.iconBg }]}>
                {metric.unit}
              </Text>
              <Text style={[styles.cellLabel, { color: P.textFaint }]}>{metric.label}</Text>
            </View>
          );
        })}
      </View>
    </GradientCard>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  inner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  cellValue: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 20,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  cellUnit: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2,
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
