import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usePalette } from '@/lib/log-theme';

// Strip trailing `.0` / `.00` and dangling decimals.
function stripTrailingZero(value: string): string {
  if (!value.includes('.')) return value;
  return value
    .replace(/(\.[0-9]*[1-9])0+$/, '$1')
    .replace(/\.0+$/, '')
    .replace(/\.$/, '');
}

// Parse for arithmetic, returning `fallback` for unparsable/empty input.
function toNumber(value: string, fallback = 0): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

// ─── QuantityStepper ────────────────────────────────────────────────────────
// −/value/+ row for numeric quantities. Used for servings, set counts, etc.
export function QuantityStepper({
  value,
  onChange,
  step = 0.5,
  min = 0,
  selectionColor,
}: {
  value:           string;
  onChange:        (v: string) => void;
  step?:           number;
  min?:            number;
  /** Caret color for the central text input. Defaults to the calories accent. */
  selectionColor?: string;
}) {
  const P = usePalette();

  const bump = (delta: number) => {
    const next = Math.max(min, toNumber(value) + delta);
    onChange(stripTrailingZero(next.toString()));
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
      <Pressable
        onPress={() => bump(-step)}
        style={[s.btn, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}
      >
        <Ionicons name="remove" size={18} color={P.text} />
      </Pressable>

      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
        keyboardType="decimal-pad"
        selectionColor={selectionColor ?? P.calories}
        style={[s.input, { color: P.text, backgroundColor: P.sunken, borderColor: P.cardEdge }]}
      />

      <Pressable
        onPress={() => bump(step)}
        style={[s.btn, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}
      >
        <Ionicons name="add" size={18} color={P.text} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    width:          42,
    height:         42,
    borderRadius:   12,
    borderWidth:    StyleSheet.hairlineWidth,
    alignItems:     'center',
    justifyContent: 'center',
  },
  input: {
    flex:          1,
    height:        42,
    borderWidth:   StyleSheet.hairlineWidth,
    borderRadius:  12,
    paddingHorizontal: 14,
    fontSize:      15,
    fontWeight:    '800',
    letterSpacing: -0.2,
    textAlign:     'center',
  },
});
