import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/lib/log-theme';

export type SelectCellOption<T extends string> = {
  id:     T;
  label:  string;
  /** Active / accent color for this option. */
  color:  string;
  /** Optional content stacked above the label (icon, dots, etc). */
  top?:   (active: boolean) => ReactNode;
};

// ─── SelectCellGrid ─────────────────────────────────────────────────────────
// Equal-width Pressable cells laid out in a row — pick one. Great for small
// enumerations (mood, soreness, intensity). Supply a `top` render for an
// icon/dot-meter above the label. Pass `gap` and `minHeight` if you need to
// tweak density.
export function SelectCellGrid<T extends string>({
  options,
  value,
  onChange,
  gap = 8,
  minHeight,
}: {
  options:   SelectCellOption<T>[];
  value:     T;
  onChange:  (v: T) => void;
  gap?:      number;
  minHeight?:number;
}) {
  const P = usePalette();
  return (
    <View style={[s.row, { gap, marginTop: 2 }]}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={({ pressed }) => [
              s.cell,
              {
                backgroundColor: active ? o.color : P.sunken,
                borderColor:     active ? o.color : P.cardEdge,
                minHeight,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            {o.top && (
              <View style={{ marginBottom: 6 }}>
                {o.top(active)}
              </View>
            )}
            <Text style={[
              s.label,
              { color: active ? '#fff' : P.text },
            ]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex:             1,
    alignItems:       'center',
    paddingVertical:  12,
    borderRadius:     14,
    borderWidth:      StyleSheet.hairlineWidth,
    gap:              6,
  },
  label: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: -0.1,
  },
});
