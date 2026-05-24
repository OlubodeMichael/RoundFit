import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRef, useEffect, useState } from 'react';

const TICK_H  = 50;  // height of the tick area
const LABEL_H = 24;  // height of the label area below ticks
const TOTAL_H = TICK_H + LABEL_H;

interface RulerPickerProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  majorEvery?: number;
  labelEvery?: number;
  formatLabel?: (v: number) => string;
  onChange: (v: number) => void;
  isDark?: boolean;
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
  isDark = false,
  tickSpacing = 10,
}: RulerPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [cW, setCW] = useState(0);

  const majorColor = isDark ? '#666' : '#AAAAAA';
  const minorColor = isDark ? '#3A3A3A' : '#D0CEC9';

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
      style={[s.wrap, { height: TOTAL_H }]}
      onLayout={(e) => setCW(e.nativeEvent.layout.width)}
    >
      {cW > 0 && (
        <>
          {/* Centre needle — no dot, spans full height */}
          <View
            pointerEvents="none"
            style={[s.needle, { left: cW / 2 - 1, height: TOTAL_H }]}
          />

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: cW / 2 }}
            snapToInterval={tickSpacing}
            decelerationRate="fast"
            onScroll={(e) => {
              const x   = e.nativeEvent.contentOffset.x;
              const idx = Math.round(x / tickSpacing);
              const v   = Math.min(max, Math.max(min, min + idx * step));
              if (v !== value) onChange(v);
            }}
          >
            {Array.from({ length: count }, (_, i) => {
              const isMajor   = i % majorEvery === 0;
              const showLabel = labelEvery > 0 && i % labelEvery === 0;
              const tickVal   = min + i * step;
              const label     = formatLabel ? formatLabel(tickVal) : String(tickVal);

              return (
                <View key={i} style={{ width: tickSpacing }}>
                  {/* Tick area — ticks grow from the bottom */}
                  <View style={s.tickArea}>
                    <View style={[
                      s.tick,
                      {
                        width:           isMajor ? 1.5 : 1,
                        height:          isMajor ? 30  : 14,
                        backgroundColor: isMajor ? majorColor : minorColor,
                      },
                    ]} />
                  </View>
                  {/* Label area — below the ticks */}
                  <View style={s.labelArea}>
                    {showLabel && (
                      <Text style={[s.label, { color: majorColor }]}>{label}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative' },

  needle: {
    position:        'absolute',
    top:             0,
    width:           2,
    backgroundColor: '#F97316',
    zIndex:          10,
    borderRadius:    1,
  },

  tickArea: {
    height:         TICK_H,
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
  tick: { borderRadius: 1 },

  labelArea: {
    height:         LABEL_H,
    alignItems:     'center',
    justifyContent: 'flex-start',
    paddingTop:     5,
  },
  label: {
    fontSize:      10,
    fontWeight:    '500',
    letterSpacing: 0.2,
  },
});
