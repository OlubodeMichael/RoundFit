import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usePalette } from '@/lib/log-theme';

export type FoodRowItem = {
  id:      string;
  name:    string;
  brand:   string;
  kcal:    number;
  serving: string;
};

// ─── FoodRow ────────────────────────────────────────────────────────────────
// Food search / popular list row with leading icon, name + brand, kcal on
// the right, and a trailing plus affordance. Consumers handle navigation
// (or direct-add) via `onPress`.
export function FoodRow({
  item,
  onPress,
}: {
  item:    FoodRowItem;
  onPress: () => void;
}) {
  const P = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        pressed && { backgroundColor: P.sunken },
      ]}
    >
      <View style={[s.icon, { backgroundColor: P.caloriesSoft }]}>
        <Ionicons name="nutrition" size={14} color={P.calories} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.name, { color: P.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[s.meta, { color: P.textFaint }]} numberOfLines={1}>
          {item.brand} · {item.serving}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[s.kcal, { color: P.text }]}>{item.kcal}</Text>
        <Text style={[s.kcalUnit, { color: P.textFaint }]}>kcal</Text>
      </View>

      <View style={[s.add, { borderColor: P.cardEdge }]}>
        <Ionicons name="add" size={14} color={P.calories} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              12,
    paddingHorizontal:18,
    paddingVertical:  14,
  },
  icon: {
    width:          32, height: 32, borderRadius: 10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  name: {
    fontSize:      14,
    fontWeight:    '800',
    letterSpacing: -0.2,
  },
  meta: {
    fontSize:      11,
    fontWeight:    '500',
  },
  kcal: {
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.3,
  },
  kcalUnit: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },
  add: {
    width:          28, height: 28, borderRadius: 9,
    borderWidth:    StyleSheet.hairlineWidth,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
