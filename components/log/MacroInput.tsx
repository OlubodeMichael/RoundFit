import { StyleSheet, Text, TextInput, View } from 'react-native';

import { usePalette } from '@/lib/log-theme';

// ─── MacroInput ─────────────────────────────────────────────────────────────
// Compact numeric input with a colored unit badge (grams). Used for protein /
// carbs / fat fields on manual entry and wherever a macro field is needed.
export function MacroInput({
  label,
  value,
  onChange,
  color,
  unit = 'g',
  placeholder = '0',
}: {
  label:        string;
  value:        string;
  onChange:     (v: string) => void;
  /** Accent color — matches the macro (protein/carbs/fat). */
  color:        string;
  unit?:        string;
  placeholder?: string;
}) {
  const P = usePalette();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.label, { color: P.textFaint }]}>
        {label.toUpperCase()}
      </Text>
      <View style={[s.wrap, { backgroundColor: P.sunken, borderColor: P.cardEdge }]}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={P.textFaint}
          style={{
            flex:          1,
            color:         P.text,
            fontSize:      16,
            fontWeight:    '800',
            letterSpacing: -0.4,
            padding:       0,
          }}
        />
        <Text style={{ color, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 1.2,
    marginBottom:  6,
  },
  wrap: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              4,
    paddingHorizontal:12,
    height:           46,
    borderRadius:     12,
    borderWidth:      StyleSheet.hairlineWidth,
  },
});
