import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { WheelPicker } from 'react-native-infinite-wheel-picker';
import { Platform, StyleSheet, View } from 'react-native';
import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

import { PICKER_H } from '@/components/ui/WheelTimePicker';

export { PICKER_H };

export interface DurationVal {
  hours: number;
  minutes: number;
}

export function stringsToDurationVal(hours: string, minutes: string): DurationVal {
  return {
    hours: Math.min(23, Math.max(0, parseInt(hours, 10) || 0)),
    minutes: Math.min(59, Math.max(0, parseInt(minutes, 10) || 0)),
  };
}

export function durationValToStrings(v: DurationVal): { hours: string; minutes: string } {
  return { hours: String(v.hours), minutes: String(v.minutes) };
}

export function formatDurationVal({ hours, minutes }: DurationVal): string {
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

/** Stable anchor so iOS countdown reads hours/minutes as duration, not wall-clock drift. */
const COUNTDOWN_ANCHOR = new Date(2000, 0, 1, 0, 0, 0, 0);

export function durationValToDate(v: DurationVal): Date {
  const d = new Date(COUNTDOWN_ANCHOR);
  d.setHours(v.hours, v.minutes, 0, 0);
  return d;
}

export function dateToDurationVal(d: Date): DurationVal {
  return {
    hours: d.getHours(),
    minutes: d.getMinutes(),
  };
}

export function durationPickerKey(v: DurationVal): string {
  return `${v.hours}-${v.minutes}`;
}

const ELEMENT_H = 54;
const REST = 3;
const CUSTOM_H = ELEMENT_H * (1 + REST * 2);

const HOURS = Array.from({ length: 24 }, (_, i) => String(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

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
  value: DurationVal;
  onChange: (v: DurationVal) => void;
  isDark: boolean;
}) {
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const selBg = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';

  const onScrollHour = useScrollHaptic(HOURS.length);
  const onScrollMinute = useScrollHaptic(MINUTES.length);

  const textStyle = {
    fontSize: 30,
    fontWeight: '400' as const,
    color: textColor,
    letterSpacing: 0,
  };

  const sharedPickerProps = {
    elementHeight: ELEMENT_H,
    restElements: REST as 2,
    elementTextStyle: textStyle,
    elementContainerStyle: custom.cell,
    selectedLayoutStyle: custom.hiddenBar,
    infiniteScroll: true,
    decelerationRate: 'fast' as const,
  } as const;

  return (
    <View style={[custom.root, { height: CUSTOM_H }]}>
      <View
        pointerEvents="none"
        style={[
          custom.selBar,
          {
            top: REST * ELEMENT_H,
            height: ELEMENT_H,
            backgroundColor: selBg,
          },
        ]}
      />
      <View style={custom.col}>
        <WheelPicker
          key={`hours-${value.hours}`}
          {...sharedPickerProps}
          data={HOURS}
          selectedIndex={value.hours}
          onChangeValue={(idx: number) => onChange({ ...value, hours: idx })}
          flatListProps={{ onScroll: onScrollHour, scrollEventThrottle: 16 }}
        />
      </View>
      <View style={custom.col}>
        <WheelPicker
          key={`minutes-${value.minutes}`}
          {...sharedPickerProps}
          data={MINUTES}
          selectedIndex={value.minutes}
          onChangeValue={(idx: number) => onChange({ ...value, minutes: idx })}
          flatListProps={{ onScroll: onScrollMinute, scrollEventThrottle: 16 }}
        />
      </View>
    </View>
  );
}

interface Props {
  value: DurationVal;
  onChange: (v: DurationVal) => void;
  isDark?: boolean;
}

export function WheelDurationPicker({ value, onChange, isDark = false }: Props) {
  const useNativeCountdown = Platform.OS === 'ios';
  const skipMountChange = useRef(true);

  useEffect(() => {
    skipMountChange.current = true;
    const frame = requestAnimationFrame(() => {
      skipMountChange.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [value.hours, value.minutes]);

  if (useNativeCountdown) {
    const handleChange = (event: DateTimePickerEvent, date?: Date) => {
      if (!date || event.type === 'dismissed') return;
      if (skipMountChange.current) return;
      onChange(dateToDurationVal(date));
    };

    return (
      <View style={native.wrap}>
        <DateTimePicker
          key={durationPickerKey(value)}
          value={durationValToDate(value)}
          mode="countdown"
          display="spinner"
          onChange={handleChange}
          themeVariant={isDark ? 'dark' : 'light'}
          style={native.picker}
        />
      </View>
    );
  }

  return (
    <CustomWheelPicker
      key={durationPickerKey(value)}
      value={value}
      onChange={onChange}
      isDark={isDark}
    />
  );
}

const native = StyleSheet.create({
  wrap: {
    width: '100%',
    height: PICKER_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
  },
});

const custom = StyleSheet.create({
  root: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  selBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 10,
    zIndex: 0,
  },
  hiddenBar: {
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  col: {
    flex: 1,
    zIndex: 1,
  },
  cell: {
    paddingHorizontal: 0,
  },
});
