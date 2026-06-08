import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { WorkoutCatalogIcon } from '@/components/log/workout/WorkoutCatalogIcon';

import { getCatalogEntryCategory } from '@/components/log/workout/WorkoutCategoryChips';
import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import {
  GradientCard,
  getCardAccent,
  type CardAccentVariant,
  type GradientCardCorner,
} from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

const CORNERS: GradientCardCorner[] = ['top-left', 'top-right'];
const ACTIVITY_ICON_SIZE = 54;

function accentVariantForEntry(entry: WorkoutCatalogEntry): CardAccentVariant {
  const category = getCatalogEntryCategory(entry);
  if (category === 'strength') return 'workouts';
  if (category === 'cardio') return 'distance';
  if (category === 'mind_body') return 'insight';
  return 'insightGrey';
}

export interface WorkoutActivityCardProps {
  entry: WorkoutCatalogEntry;
  selected: boolean;
  cornerIndex: number;
  onPress: () => void;
}

export function WorkoutActivityCard({
  entry,
  selected,
  cornerIndex,
  onPress,
}: WorkoutActivityCardProps) {
  const P = usePalette();
  const variant = accentVariantForEntry(entry);
  const accent = getCardAccent(variant, P.isDark);
  const palette = { card: P.card, cardEdge: P.cardEdge, isDark: P.isDark };
  const corner = CORNERS[cornerIndex % CORNERS.length] ?? 'top-left';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <GradientCard
        variant={variant}
        palette={palette}
        layout="metric"
        corner={corner}
        animated={false}
        style={styles.card}
        contentStyle={[
          styles.inner,
          {
            borderColor: selected ? accent.iconBg : P.cardEdge,
            borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        {selected && (
          <View style={[styles.check, { backgroundColor: accent.iconBg }]}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
          </View>
        )}

        <WorkoutCatalogIcon
          entry={entry}
          size={ACTIVITY_ICON_SIZE}
          color={accent.iconBg}
          weight={selected ? 'bold' : 'semibold'}
        />

        <Text style={[styles.label, { color: P.text }]} numberOfLines={2}>
          {entry.label}
        </Text>
      </GradientCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '48%',
    minWidth: 0,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  card: {
    width: '100%',
  },
  inner: {
    minHeight: 128,
    paddingHorizontal: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
});
