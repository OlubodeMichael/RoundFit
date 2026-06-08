import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { WorkoutCatalogEntry } from '@/config/workout-catalog';
import { usePalette } from '@/lib/log-theme';

export type WorkoutCategoryFilter = 'all' | 'strength' | 'cardio' | 'mind_body' | 'other';

const CATEGORY_OPTIONS: { id: WorkoutCategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'mind_body', label: 'Mind & body' },
  { id: 'other', label: 'Other' },
];

export function getCatalogEntryCategory(
  entry: WorkoutCatalogEntry,
): Exclude<WorkoutCategoryFilter, 'all'> {
  if (entry.id === 'other') return 'other';
  if (entry.id === 'yoga') return 'mind_body';
  if (entry.sessionMode === 'strength') return 'strength';
  return 'cardio';
}

export function filterCatalogByCategory(
  entries: readonly WorkoutCatalogEntry[],
  category: WorkoutCategoryFilter,
): WorkoutCatalogEntry[] {
  if (category === 'all') return [...entries];
  return entries.filter((e) => getCatalogEntryCategory(e) === category);
}

export interface WorkoutCategoryChipsProps {
  value: WorkoutCategoryFilter;
  onChange: (category: WorkoutCategoryFilter) => void;
}

export function WorkoutCategoryChips({ value, onChange }: WorkoutCategoryChipsProps) {
  const P = usePalette();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <View style={[styles.track, { backgroundColor: P.sunken }]}>
        {CATEGORY_OPTIONS.map((opt) => {
          const active = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={opt.label}
              style={({ pressed }) => [
                styles.segment,
                active && { backgroundColor: P.card },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.label,
                  { color: active ? P.text : P.textFaint },
                  active && styles.labelActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 2 },
  track: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  pressed: { opacity: 0.85 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  labelActive: {
    fontWeight: '700',
  },
});
