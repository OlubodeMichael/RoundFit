import { Pressable, StyleSheet, Text, View } from 'react-native';
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
    <View style={s.field}>
      <View style={s.header}>
        <Text style={s.headerLabel}>{label}</Text>

        <View style={s.unitToggle} accessibilityRole="radiogroup">
          {unitOptions.map((opt) => (
            <Pressable
              key={opt.label}
              onPress={opt.onPress}
              style={({ pressed }) => [
                s.unitOption,
                opt.active && s.unitOptionActive,
                pressed && s.unitOptionPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: opt.active }}
              accessibilityLabel={`Use ${opt.label} for ${label.toLowerCase()}`}
            >
              <Text style={[s.unitText, opt.active && s.unitTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={s.numberRow}>
        <Text style={s.number} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {displayValue}
        </Text>
        <Text style={s.unitLabel}>{displayUnit}</Text>
      </View>

      <View style={s.rulerWell}>
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
          accessibilityLabel={`${label} picker`}
          accessibilityValueText={`${displayValue}${displayUnit ? ` ${displayUnit}` : ''}`}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  field: { gap: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 19,
    color: '#111111',
    letterSpacing: -0.4,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: '#EFEBE6',
    borderRadius: 999,
    padding: 3,
  },
  unitOption: {
    minHeight: 34,
    minWidth: 50,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitOptionActive: { backgroundColor: '#111111' },
  unitOptionPressed: { opacity: 0.68 },
  unitText: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 13,
    color: '#6F6A63',
    letterSpacing: -0.1,
  },
  unitTextActive: { color: '#FFFFFF' },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    minHeight: 70,
  },
  number: {
    maxWidth: '78%',
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 60,
    letterSpacing: -3,
    color: '#111111',
    lineHeight: 66,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 18,
    color: '#77716A',
    letterSpacing: -0.3,
    paddingBottom: 7,
  },
  rulerWell: {
    height: 96,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F1EEEA',
    overflow: 'hidden',
  },
});
