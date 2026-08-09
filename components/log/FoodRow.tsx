import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/lib/log-theme';

export type FoodRowItem = {
  id:      string;
  name:    string;
  brand:   string;
  kcal:    number;
  serving: string;
};

// ─── FoodRow ────────────────────────────────────────────────────────────────
// Food search result row: name + brand/serving on the left, kcal on the right.
// Deliberately icon-free — the leading glyph and trailing plus repeated on every
// row added noise without adding meaning. Consumers handle navigation (or
// direct-add) via `onPress`.
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
});
