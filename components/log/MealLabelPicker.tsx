import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usePalette } from '@/lib/log-theme';
import type { MealLabel } from '@/components/log/ManualMealInputModal';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// ─── Options ───────────────────────────────────────────────────────────────
// Single source of truth for meal labels + their icons. Any screen that
// shows a meal picker should import from here so the set stays consistent.
export const MEAL_OPTIONS: { id: MealLabel; label: string; icon: IoniconName }[] = [
  { id: 'breakfast',    label: 'Breakfast',    icon: 'cafe-outline'       },
  { id: 'lunch',        label: 'Lunch',        icon: 'restaurant-outline' },
  { id: 'dinner',       label: 'Dinner',       icon: 'moon-outline'       },
  { id: 'snack',        label: 'Snack',        icon: 'nutrition-outline'  },
  { id: 'pre_workout',  label: 'Pre workout',  icon: 'flash-outline'      },
  { id: 'post_workout', label: 'Post workout', icon: 'barbell-outline'    },
];

// ─── Helper ────────────────────────────────────────────────────────────────
/** Picks a reasonable default meal label based on the current hour of day. */
export function guessMealLabel(now: Date = new Date()): MealLabel {
  const h = now.getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 21) return 'dinner';
  return 'snack';
}

// ─── Component ─────────────────────────────────────────────────────────────
export function MealLabelPicker({
  value,
  onChange,
  accent,
}: {
  value:    MealLabel;
  onChange: (v: MealLabel) => void;
  /** Color for the active pill. Defaults to the calories accent. */
  accent?:  string;
}) {
  const P   = usePalette();
  const acc = accent ?? P.calories;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {MEAL_OPTIONS.map((m) => {
        const active = m.id === value;
        return (
          <Pressable
            key={m.id}
            onPress={() => onChange(m.id)}
            style={({ pressed }) => [
              s.pill,
              {
                backgroundColor: active ? acc : P.sunken,
                borderColor:     active ? acc : P.cardEdge,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons
              name={m.icon}
              size={13}
              color={active ? '#fff' : P.textDim}
            />
            <Text style={[
              s.label,
              { color: active ? '#fff' : P.text },
            ]}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              6,
    paddingHorizontal:12,
    paddingVertical:  9,
    borderRadius:     999,
    borderWidth:      StyleSheet.hairlineWidth,
  },
  label: {
    fontSize:      12,
    fontWeight:    '800',
    letterSpacing: -0.1,
  },
});
