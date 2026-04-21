import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  value:    number;
  unit:     string;
  min?:     number;
  max?:     number;
  step?:    number;
  onChange: (next: number) => void;
}

const HI = '#111111';
const MID = '#888';
const LO  = '#E8E3DC';

export function NumericStepper({ value, unit, min = 0, max = 999, step = 1, onChange }: Props) {
  const change = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));

  return (
    <View style={s.row}>
      <TouchableOpacity
        style={[s.btn, { borderColor: LO }]}
        onPress={() => change(-step)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${unit}`}
      >
        <Text style={[s.btnText, { color: HI }]}>−</Text>
      </TouchableOpacity>

      <View style={s.display}>
        <Text style={[s.num, { color: HI }]}>{value}</Text>
        <Text style={[s.unit, { color: MID }]}>{unit}</Text>
      </View>

      <TouchableOpacity
        style={[s.btn, { borderColor: LO }]}
        onPress={() => change(step)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${unit}`}
      >
        <Text style={[s.btnText, { color: HI }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 },
  btn:     { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnText: { fontSize: 28, fontWeight: '200', lineHeight: 34 },
  display: { alignItems: 'center', minWidth: 120 },
  num:     { fontSize: 80, fontWeight: '900', letterSpacing: -3, lineHeight: 84 },
  unit:    { fontSize: 13, fontWeight: '500', marginTop: -6 },
});
