import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { RulerPicker } from './ruler-picker';

export interface UnitOption {
  label: string;
  active: boolean;
  onPress: () => void;
}

interface MeasurementPickerProps {
  /** Section label e.g. "Weight" or "Height" */
  label: string;
  /** Current value driving the ruler position */
  value: number;
  onChange: (v: number) => void;
  /** Large number shown above the ruler e.g. "172" */
  displayValue: string;
  /** Small unit label shown beside the number e.g. "cm" */
  displayUnit: string;
  min: number;
  max: number;
  step?: number;
  majorEvery?: number;
  labelEvery?: number;
  formatLabel?: (v: number) => string;
  tickSpacing?: number;
  unitOptions: UnitOption[];
}

export function MeasurementPicker({
  label,
  value,
  onChange,
  displayValue,
  displayUnit,
  min,
  max,
  step = 1,
  majorEvery = 5,
  labelEvery = 10,
  formatLabel,
  tickSpacing = 10,
  unitOptions,
}: MeasurementPickerProps) {
  return (
    <View style={s.card}>
      {/* ── Header ─────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.headerLabel}>{label}</Text>
        <View style={s.pill}>
          {unitOptions.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              onPress={opt.onPress}
              style={[s.pillOption, opt.active && s.pillActive]}
              activeOpacity={0.75}
            >
              <Text style={[s.pillText, opt.active && s.pillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Big number ─────────────────────────── */}
      <View style={s.numberRow}>
        <Text style={s.number}>{displayValue}</Text>
        <Text style={s.unitLabel}>{displayUnit}</Text>
      </View>

      {/* ── Ruler ──────────────────────────────── */}
      <RulerPicker
        value={value}
        min={min}
        max={max}
        step={step}
        majorEvery={majorEvery}
        labelEvery={labelEvery}
        formatLabel={formatLabel}
        onChange={onChange}
        isDark={false}
        tickSpacing={tickSpacing}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#F2F1EE',
    borderRadius:    20,
    paddingHorizontal: 20,
    paddingTop:      12,
    paddingBottom:   14,
  },

  // ── Header ──────────────────────────────────
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  headerLabel: {
    fontSize:      15,
    fontWeight:    '500',
    color:         '#888888',
    letterSpacing: 0.1,
  },

  // Unit toggle pill
  pill: {
    flexDirection:   'row',
    backgroundColor: '#E5E4E0',
    borderRadius:    50,
    padding:         3,
  },
  pillOption: {
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      50,
  },
  pillActive: {
    backgroundColor: '#111111',
  },
  pillText: {
    fontSize:      13,
    fontWeight:    '600',
    color:         '#999999',
    letterSpacing: -0.1,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },

  // ── Big number ──────────────────────────────
  numberRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           6,
    marginBottom:  8,
  },
  number: {
    fontSize:      54,
    fontWeight:    '900',
    letterSpacing: -2.5,
    color:         '#111111',
    lineHeight:    58,
  },
  unitLabel: {
    fontSize:      22,
    fontWeight:    '500',
    color:         '#999999',
    letterSpacing: -0.3,
    paddingBottom: 6,
  },
});
