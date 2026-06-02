import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { HydrationProgressRing } from '@/components/home/HydrationProgressRing';
import { WaterQuickAdd } from '@/components/log/WaterQuickAdd';
import { useToast } from '@/components/ui/Toast';
import { useWater } from '@/hooks/use-water';
import { AnimatedCard } from '@/lib/log-theme';

const ML_PER_OZ = 29.5735;
const OZ_ROUND = (oz: number) => Math.round(oz);

export interface HydrationCardPalette {
  text: string;
  textDim: string;
  textFaint: string;
  sage: string;
  water: string;
}

interface HydrationCardProps {
  P: HydrationCardPalette;
  delay?: number;
  onViewAll?: () => void;
}

export function HydrationCard({ P, delay = 0, onViewAll }: HydrationCardProps) {
  const { totalMl, goalMl, logWater } = useWater();
  const toast = useToast();

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
    <AnimatedCard delay={delay} padding={18}>
      <View style={s.header}>
        <Text style={[s.title, { color: P.text }]}>Hydration</Text>
        {onViewAll && (
          <TouchableOpacity
            onPress={onViewAll}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="View water log"
          >
            <Ionicons name="chevron-forward" size={18} color={P.textFaint} />
          </TouchableOpacity>
        )}
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
            style={[
              s.remainLine,
              { color: isComplete ? P.sage : P.water },
            ]}
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
    </AnimatedCard>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 16,
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
    marginTop: 2,
  },
});
