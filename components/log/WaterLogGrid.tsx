import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { WaterDayEntries } from '@/components/log/WaterDayEntries';
import { WaterEmptyState } from '@/components/log/WaterEmptyState';
import {
  WaterReservoirHero,
  type WaterReservoirHeroProps,
} from '@/components/log/WaterReservoirHero';
import { usePalette } from '@/lib/log-theme';
import type { WaterEntry } from '@/context/water-context';

const CARD_RADIUS = 16;
const INSET = 14;

interface WaterLogGridProps extends WaterReservoirHeroProps {
  entries: WaterEntry[];
  dayIsToday: boolean;
  onDelete: (id: string) => void;
}

function AppleCard({
  children,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const P = usePalette();

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: P.card,
          borderColor: P.cardEdge,
          shadowOpacity: P.isDark ? 0.35 : 0.06,
        },
        Platform.OS === 'android' && { elevation: P.isDark ? 0 : 2 },
        style,
      ]}
      accessibilityRole={accessibilityLabel ? 'summary' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
}

export function WaterLogGrid({
  entries,
  dayIsToday,
  onDelete,
  sipCount,
  ...heroProps
}: WaterLogGridProps) {
  const P = usePalette();
  const hasEntries = entries.length > 0;

  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: P.textFaint }]}>Hydration</Text>

      <View style={s.grid}>
        <AppleCard
          style={s.jarCard}
          accessibilityLabel="Water intake progress"
        >
          <WaterReservoirHero {...heroProps} sipCount={sipCount} layout="side" />
        </AppleCard>

        <AppleCard
          style={s.logCard}
          accessibilityLabel={`Hydration log, ${sipCount} ${sipCount === 1 ? 'entry' : 'entries'}`}
        >
          {hasEntries ? (
            <WaterDayEntries entries={entries} onDelete={onDelete} layout="side" embedded />
          ) : (
            <WaterEmptyState isToday={dayIsToday} variant="embedded" />
          )}
        </AppleCard>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.08,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  jarCard: {
    flex: 0.9,
    minWidth: 0,
    padding: INSET,
    paddingBottom: INSET - 2,
  },
  logCard: {
    flex: 1.1,
    minWidth: 0,
    padding: INSET,
    minHeight: 228,
  },
});
