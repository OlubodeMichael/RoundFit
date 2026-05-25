import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { WheelPicker } from 'react-native-infinite-wheel-picker';
import { Platform, StyleSheet, View } from 'react-native';
import { useRef } from 'react';
import * as Haptics from 'expo-haptics';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeVal {
  hour:   number;   // 1–12
  minute: number;   // 0–59
  period: 'AM' | 'PM';
}

// ── Conversions ───────────────────────────────────────────────────────────────

export function timeValToDate(v: TimeVal): Date {
  let h24 = v.hour % 12;
  if (v.period === 'PM') h24 += 12;
  const d = new Date();
  d.setHours(h24, v.minute, 0, 0);
  return d;
}

export function dateToTimeVal(d: Date): TimeVal {
  const h24 = d.getHours();
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  return { hour, minute: d.getMinutes(), period };
}

// ── Layout ────────────────────────────────────────────────────────────────────

/** Native iOS spinner height; custom wheel uses a taller drum. */
export const PICKER_H = Platform.select({
  ios:     216,
  android: 200,
  default: 378,
}) as number;

// ── Custom wheel (web fallback) ───────────────────────────────────────────────

const ELEMENT_H   = 54;
const REST        = 3;
const CUSTOM_H    = ELEMENT_H * (1 + REST * 2);

const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

function useScrollHaptic(dataLen: number) {
  const last = useRef(-1);
  return (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const raw = Math.round(e.nativeEvent.contentOffset.y / ELEMENT_H);
    const idx = ((raw % dataLen) + dataLen) % dataLen;
    if (idx !== last.current) {
      last.current = idx;
      Haptics.selectionAsync();
    }
  };
}

function CustomWheelPicker({
  value,
  onChange,
  isDark,
}: {
  value:    TimeVal;
  onChange: (v: TimeVal) => void;
  isDark:   boolean;
}) {
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const selBg     = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';

  const onScrollHour   = useScrollHaptic(HOURS.length);
  const onScrollMinute = useScrollHaptic(MINUTES.length);
  const onScrollPeriod = useScrollHaptic(PERIODS.length);

  const textStyle = {
    fontSize:      30,
    fontWeight:    '400' as const,
    color:         textColor,
    letterSpacing: 0,
  };

  const sharedPickerProps = {
    elementHeight:          ELEMENT_H,
    restElements:           REST as 2,
    elementTextStyle:       textStyle,
    elementContainerStyle:  custom.cell,
    selectedLayoutStyle:    custom.hiddenBar,
    infiniteScroll:         true,
    decelerationRate:       'fast' as const,
  } as const;

  return (
    <View style={[custom.root, { height: CUSTOM_H }]}>
      <View
        pointerEvents="none"
        style={[
          custom.selBar,
          {
            top:             REST * ELEMENT_H,
            height:          ELEMENT_H,
            backgroundColor: selBg,
          },
        ]}
      />
      <View style={custom.col}>
        <WheelPicker
          {...sharedPickerProps}
          data={HOURS}
          selectedIndex={value.hour - 1}
          onChangeValue={(idx: number) => onChange({ ...value, hour: idx + 1 })}
          flatListProps={{ onScroll: onScrollHour, scrollEventThrottle: 16 }}
        />
      </View>
      <View style={custom.col}>
        <WheelPicker
          {...sharedPickerProps}
          data={MINUTES}
          selectedIndex={value.minute}
          onChangeValue={(idx: number) => onChange({ ...value, minute: idx })}
          flatListProps={{ onScroll: onScrollMinute, scrollEventThrottle: 16 }}
        />
      </View>
      <View style={[custom.col, custom.colPeriod]}>
        <WheelPicker
          {...sharedPickerProps}
          data={PERIODS}
          selectedIndex={value.period === 'PM' ? 1 : 0}
          onChangeValue={(idx: number) => onChange({ ...value, period: PERIODS[idx] as 'AM' | 'PM' })}
          flatListProps={{ onScroll: onScrollPeriod, scrollEventThrottle: 16 }}
          infiniteScroll={false}
        />
      </View>
    </View>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  value:        TimeVal;
  onChange:     (v: TimeVal) => void;
  accentColor?: string;
  isDark?:      boolean;
}

export function WheelTimePicker({ value, onChange, isDark = false }: Props) {
  const useNative = Platform.OS === 'ios' || Platform.OS === 'android';

  if (useNative) {
    const handleChange = (_event: DateTimePickerEvent, date?: Date) => {
      if (!date) return;
      onChange(dateToTimeVal(date));
    };

    return (
      <View style={native.wrap}>
        <DateTimePicker
          value={timeValToDate(value)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
          onChange={handleChange}
          themeVariant={isDark ? 'dark' : 'light'}
          style={native.picker}
        />
      </View>
    );
  }

  return <CustomWheelPicker value={value} onChange={onChange} isDark={isDark} />;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const native = StyleSheet.create({
  wrap: {
    width:          '100%',
    height:         PICKER_H,
    alignItems:     'center',
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
  },
});

const custom = StyleSheet.create({
  root: {
    flexDirection: 'row',
    overflow:      'hidden',
  },
  selBar: {
    position:     'absolute',
    left:         0,
    right:        0,
    borderRadius: 10,
    zIndex:       0,
  },
  hiddenBar: {
    backgroundColor: 'transparent',
    borderRadius:    0,
  },
  col: {
    flex:   2,
    zIndex: 1,
  },
  colPeriod: {
    flex: 1.5,
  },
  cell: {
    paddingHorizontal: 0,
  },
});
