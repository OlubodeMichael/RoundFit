import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { HydrationProgressRing } from '@/components/home/HydrationProgressRing';
import { WaterQuickAdd } from '@/components/log/WaterQuickAdd';
import { GradientCard, getCardAccent } from '@/components/ui/GradientCard';
import { useToast } from '@/components/ui/Toast';
import { useWater } from '@/hooks/use-water';

const ML_PER_OZ = 29.5735;
const OZ_ROUND = (oz: number) => Math.round(oz);
const HEADER_ICON_SIZE = 32;

export interface HydrationCardPalette {
  card: string;
  cardEdge: string;
  text: string;
  textDim: string;
  textFaint: string;
  sage: string;
  water: string;
  isDark: boolean;
}

export interface HydrationCardProps {
  P: HydrationCardPalette;
  delay?: number;
  onViewAll?: () => void;
}

export function HydrationCard({ P, delay = 0, onViewAll }: HydrationCardProps) {
  const { totalMl, goalMl, logWater } = useWater();
  const toast = useToast();
  const accent = getCardAccent('water', P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };

  const goalOz = goalMl / ML_PER_OZ;
  const totalOz = totalMl / ML_PER_OZ;
  const progress = Math.min(totalMl / Math.max(goalMl, 1), 1);
  const pct = Math.round(progress * 100);
  const remainOz = Math.max(0, goalOz - totalOz);
  const isComplete = progress >= 1;

  const handleAdd = async (ml: number) => {
    try {
      await logWater(ml);
    } catch {
      toast.error('Could not save', 'Please try again.');
    }
  };

  return (
    <GradientCard
      variant="water"
      palette={palette}
      corner="top-right"
      delay={delay}
    >
      <View style={s.header}>
        <View style={s.headerMain}>
          <Ionicons name="water" size={HEADER_ICON_SIZE} color={accent.iconBg} />
          <View style={s.headerCopy}>
            <Text style={[s.headerTitle, { color: P.text }]}>Hydration</Text>
            <Text style={[s.headerCaption, { color: P.textDim }]}>
              {OZ_ROUND(totalOz)} of {OZ_ROUND(goalOz)} oz · {pct}%
            </Text>
          </View>
        </View>
        {onViewAll ? (
          <TouchableOpacity
            onPress={onViewAll}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="View water log"
          >
            <Ionicons name="chevron-forward" size={16} color={P.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={s.progressRow}>
        <HydrationProgressRing progress={progress} percent={pct} />

        <View style={s.stats}>
          <Text style={[s.amount, { color: P.text }]}>
            {OZ_ROUND(totalOz)}
            <Text style={[s.amountUnit, { color: P.textDim }]}> fl oz</Text>
          </Text>
          <Text style={[s.goalLine, { color: P.textFaint }]}>
            of {OZ_ROUND(goalOz)} oz goal
          </Text>
          <Text
            style={[s.remainLine, { color: isComplete ? P.sage : P.water }]}
          >
            {isComplete
              ? 'Goal reached'
              : `${OZ_ROUND(remainOz)} oz remaining`}
          </Text>
        </View>
      </View>

      <View style={s.quickAdd}>
        <WaterQuickAdd onAdd={handleAdd} />
      </View>
    </GradientCard>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 8,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.45,
    lineHeight: 24,
  },
  headerCaption: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 18,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  stats: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  amountUnit: {
    fontSize: 16,
    fontWeight: '600',
  },
  goalLine: {
    fontSize: 13,
    fontWeight: '500',
  },
  remainLine: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  quickAdd: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
