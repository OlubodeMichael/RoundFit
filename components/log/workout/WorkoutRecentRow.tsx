import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WorkoutCatalogIcon } from '@/components/log/workout/WorkoutCatalogIcon';
import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import { getCardAccent } from '@/components/ui/GradientCard';
import { usePalette } from '@/lib/log-theme';

export interface WorkoutRecentRowProps {
  entries: readonly WorkoutCatalogEntry[];
  onSelect: (entry: WorkoutCatalogEntry) => void;
}

export function WorkoutRecentRow({ entries, onSelect }: WorkoutRecentRowProps) {
  const P = usePalette();
  const accent = getCardAccent('workouts', P.isDark);

  if (entries.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: P.textFaint }]}>Recent</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {entries.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={() => onSelect(entry)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: P.card, borderColor: P.cardEdge },
              pressed && styles.pressed,
            ]}
          >
            <WorkoutCatalogIcon entry={entry} size={28} color={accent.iconBg} />
            <Text style={[styles.chipText, { color: P.text }]} numberOfLines={1}>
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 168,
  },
  pressed: { opacity: 0.85 },
  chipText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
});
