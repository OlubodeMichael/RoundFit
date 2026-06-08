import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import {
  PICKER_H,
  WheelDurationPicker,
  durationPickerKey,
  durationValToStrings,
  formatDurationVal,
  stringsToDurationVal,
} from '@/components/ui/WheelDurationPicker';
import { usePalette } from '@/lib/log-theme';

export interface WorkoutDurationPickerProps {
  hours: string;
  minutes: string;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  estimatedCals: number;
  totalMinutes: number;
  sectionLabel?: string;
  sectionTitle?: string;
  /** `sheet` = faint uppercase (log sheet); `configure` = bold section title (launcher). */
  variant?: 'sheet' | 'configure';
}

export function WorkoutDurationPicker({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  estimatedCals,
  totalMinutes,
  sectionLabel,
  sectionTitle = 'Duration',
  variant = 'sheet',
}: WorkoutDurationPickerProps) {
  const P = usePalette();
  const durationVal = stringsToDurationVal(hours, minutes);

  const handleDurationChange = (next: ReturnType<typeof stringsToDurationVal>) => {
    const { hours: h, minutes: m } = durationValToStrings(next);
    onHoursChange(h);
    onMinutesChange(m);
  };

  const label =
    sectionLabel ?? (variant === 'sheet' ? sectionTitle.toUpperCase() : sectionTitle);

  return (
    <View style={s.section}>
      <Text
        style={[
          variant === 'configure' ? s.sectionTitle : s.sectionLabel,
          { color: variant === 'configure' ? P.text : P.textFaint },
        ]}
      >
        {label}
      </Text>
      <View
        style={[s.card, { backgroundColor: P.card, borderColor: P.cardEdge }]}
      >
        <View style={s.summaryRow}>
          <Text style={[s.summaryValue, { color: P.text }]}>
            {formatDurationVal(durationVal)}
          </Text>
        </View>
        <View style={[s.pickerWrap, { height: PICKER_H }]}>
          <WheelDurationPicker
            key={durationPickerKey(durationVal)}
            value={durationVal}
            onChange={handleDurationChange}
            isDark={P.isDark}
          />
        </View>
        {totalMinutes > 0 ? (
          <View style={[s.calRow, { borderTopColor: P.hair }]}>
            <Ionicons name="flame" size={13} color={P.calories} />
            <Text style={[s.calText, { color: P.textFaint }]}>Estimated</Text>
            <Text style={[s.calNum, { color: P.calories }]}>{estimatedCals}</Text>
            <Text style={[s.calUnit, { color: P.textFaint }]}>kcal</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  summaryRow: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pickerWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  calText: { fontSize: 11, fontWeight: '600' },
  calNum: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 16,
    letterSpacing: 0,
  },
  calUnit: { fontSize: 11, fontWeight: '600' },
});
