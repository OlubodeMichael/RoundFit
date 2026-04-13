import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRef, useEffect, useState } from 'react';

interface RulerPickerProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  majorEvery?: number;
  labelEvery?: number;
  formatLabel?: (v: number) => string;
  onChange: (v: number) => void;
  isDark: boolean;
  tickSpacing?: number;
}

export function RulerPicker({
  value,
  min,
  max,
  step = 1,
  majorEvery = 5,
  labelEvery = 10,
  formatLabel,
  onChange,
  isDark,
  tickSpacing = 14,
}: RulerPickerProps) {
  const scrollRef   = useRef<ScrollView>(null);
  const [cW, setCW] = useState(0);

  const mid    = isDark ? '#2E2E2E' : '#DEDEDE';
  const strong = isDark ? '#555555' : '#BBBBBB';

  useEffect(() => {
    if (cW > 0) {
      const idx = Math.round((value - min) / step);
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: idx * tickSpacing, animated: false });
      }, 0);
      return () => clearTimeout(t);
    }
  }, [cW]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = Math.round((max - min) / step) + 1;

  return (
    <View
      style={s.wrap}
      onLayout={(e) => setCW(e.nativeEvent.layout.width)}
    >
      {cW > 0 && (
        <>
          <View pointerEvents="none" style={[s.needle, { left: cW / 2 - 1 }]} />
          <View pointerEvents="none" style={[s.needleDot, { left: cW / 2 - 5 }]} />

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: cW / 2 }}
            snapToInterval={tickSpacing}
            decelerationRate="fast"
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const idx = Math.round(x / tickSpacing);
              const v = Math.min(max, Math.max(min, min + idx * step));
              if (v !== value) onChange(v);
            }}
          >
            <View style={s.tickRow}>
              {Array.from({ length: count }, (_, i) => {
                const isMajor   = i % majorEvery === 0;
                const showLabel = labelEvery > 0 && i % labelEvery === 0;
                const tickVal   = min + i * step;
                const labelStr  = formatLabel ? formatLabel(tickVal) : String(tickVal);
                return (
                  <View key={i} style={[s.tickCell, { width: tickSpacing }]}>
                    {showLabel && (
                      <Text
                        style={[s.label, {
                          color: strong,
                          // Center the 44px label over the tick center
                          left: tickSpacing / 2 - 22,
                        }]}
                      >
                        {labelStr}
                      </Text>
                    )}
                    <View style={[
                      s.tick,
                      {
                        width:           isMajor ? 1.5 : 1,
                        height:          isMajor ? 26  : 11,
                        backgroundColor: isMajor ? strong : mid,
                      },
                    ]} />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { height: 72, position: 'relative' },

  needle: {
    position: 'absolute', top: 0,
    width: 2, height: 50,
    backgroundColor: '#F97316',
    zIndex: 10, borderRadius: 1,
  },
  needleDot: {
    position: 'absolute', top: -5,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#F97316', zIndex: 10,
  },

  tickRow:  { flexDirection: 'row', alignItems: 'flex-end', height: 72 },
  tickCell: { alignItems: 'center', justifyContent: 'flex-end', height: 72 },
  label:    {
    position: 'absolute',
    bottom: 32,        // sits just above the tallest tick (26px) + small gap
    width: 44,         // wide enough for 3-digit numbers + unit suffix
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tick:     { borderRadius: 1 },
});
