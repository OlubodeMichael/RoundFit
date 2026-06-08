import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { RecoveryTrendGradientCard } from '@/components/recovery/RecoveryTrendGradientCard';
import type { TrendPalette } from '@/components/recovery/recovery-trend-utils';
import type { ReadinessFactor } from '@/types/readiness';

export interface RecoveryFactorsCardProps {
  factors: ReadinessFactor[];
  palette: TrendPalette;
  readinessScore: number;
  renderRow: (factor: ReadinessFactor, last: boolean) => ReactNode;
}

export function RecoveryFactorsCard({
  factors,
  palette,
  readinessScore,
  renderRow,
}: RecoveryFactorsCardProps) {
  if (factors.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.textFaint }]}>
          WHAT MOVED THE SCORE
        </Text>
        <Ionicons name="trending-up-outline" size={13} color={palette.textFaint} />
      </View>
      <RecoveryTrendGradientCard
        palette={palette}
        readinessScore={readinessScore}
        corner="bottom-left"
        contentStyle={styles.cardInner}
      >
        {factors.map((f, i) => renderRow(f, i === factors.length - 1))}
      </RecoveryTrendGradientCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  cardInner: {
    overflow: 'hidden',
    paddingVertical: 2,
  },
});
