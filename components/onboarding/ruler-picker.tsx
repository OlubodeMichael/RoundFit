import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRef, useEffect, useState } from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const TICK_H  = 60;
const LABEL_H = 24;
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
  accessibilityLabel?: string;
  accessibilityValueText?: string;
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
  accessibilityLabel = 'Measurement picker',
  accessibilityValueText,
}: RulerPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [cW, setCW] = useState(0);
  const tickPlayer = useRef<AudioPlayer | null>(null);
  const lastEmittedValue = useRef(value);
  const isUserScrolling = useRef(false);
  const momentumStarted = useRef(false);
  const interactionEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFeedbackAt = useRef(0);

  const majorColor = isDark ? '#666' : '#AAAAAA';
  const minorColor = isDark ? '#3A3A3A' : '#D0CEC9';

  useEffect(() => {
    // A newly installed native module is unavailable until the development app
    // is rebuilt. Keep the ruler usable (with haptics) in an older build and
    // enable its sound automatically as soon as ExpoAudio is present.
    if (!requireOptionalNativeModule('ExpoAudio')) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createAudioPlayer } = require('expo-audio') as typeof import('expo-audio');
      const player = createAudioPlayer(require('../../assets/sounds/ruler-tick.wav'));
      player.volume = 0.22;
      tickPlayer.current = player;

      return () => {
        tickPlayer.current = null;
        player.remove();
      };
    } catch {
      tickPlayer.current = null;
    }
  }, []);

  useEffect(() => {
    lastEmittedValue.current = value;
  }, [value]);

  useEffect(() => () => {
    if (interactionEndTimer.current) clearTimeout(interactionEndTimer.current);
  }, []);

  const playTickFeedback = () => {
    const now = Date.now();
    if (now - lastFeedbackAt.current < 55) return;
    lastFeedbackAt.current = now;

    void Haptics.selectionAsync().catch(() => undefined);
    const player = tickPlayer.current;
    if (!player) return;

    void player.seekTo(0)
      .then(() => player.play())
      .catch(() => undefined);
  };

  const emitValue = (nextValue: number, withFeedback: boolean) => {
    if (nextValue === lastEmittedValue.current) return;
    lastEmittedValue.current = nextValue;
    onChange(nextValue);
    if (withFeedback) playTickFeedback();
  };

  useEffect(() => {
    if (cW > 0) {
      const idx = Math.round((value - min) / step);
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ x: idx * tickSpacing, animated: false });
      }, 0);
      return () => clearTimeout(t);
    }
  }, [cW, value, min, step, tickSpacing]);

  const count = Math.round((max - min) / step) + 1;

  return (
    <View
      style={[s.wrap, { height: TOTAL_H }]}
      onLayout={(e) => setCW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: accessibilityValueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') {
          emitValue(Math.min(max, value + step), true);
        }
        if (event.nativeEvent.actionName === 'decrement') {
          emitValue(Math.max(min, value - step), true);
        }
      }}
    >
      {cW > 0 && (
        <>
          <View pointerEvents="none" style={[s.indicator, { left: cW / 2 - 4 }]}>
            <View style={s.indicatorDot} />
            <View style={s.needle} />
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingHorizontal: cW / 2 }}
            snapToInterval={tickSpacing}
            decelerationRate="fast"
            onScrollBeginDrag={() => {
              if (interactionEndTimer.current) clearTimeout(interactionEndTimer.current);
              momentumStarted.current = false;
              isUserScrolling.current = true;
            }}
            onScrollEndDrag={() => {
              interactionEndTimer.current = setTimeout(() => {
                if (!momentumStarted.current) isUserScrolling.current = false;
              }, 80);
            }}
            onMomentumScrollBegin={() => {
              momentumStarted.current = true;
              isUserScrolling.current = true;
            }}
            onMomentumScrollEnd={() => {
              momentumStarted.current = false;
              isUserScrolling.current = false;
            }}
            onScroll={(e) => {
              const x   = e.nativeEvent.contentOffset.x;
              const idx = Math.round(x / tickSpacing);
              const v   = Math.min(max, Math.max(min, min + idx * step));
              emitValue(v, isUserScrolling.current);
            }}
          >
            {Array.from({ length: count }, (_, i) => {
              const tickVal   = min + i * step;
              const tickIndex = Math.round(tickVal / step);
              const isMajor   = tickIndex % majorEvery === 0;
              const showLabel = labelEvery > 0 && tickIndex % labelEvery === 0;
              const label     = formatLabel ? formatLabel(tickVal) : String(tickVal);

              return (
                <View key={i} style={{ width: tickSpacing }}>
                  {/* Tick area — ticks grow from the bottom */}
                  <View style={s.tickArea}>
                    <View style={[
                      s.tick,
                      {
                        width:           isMajor ? 1.5 : 1,
                        height:          isMajor ? 40  : 19,
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
  wrap: { position: 'relative', overflow: 'hidden' },

  indicator: {
    position: 'absolute',
    top: 5,
    width: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
  },
  needle: {
    width: 2,
    height: 66,
    backgroundColor: '#F97316',
    borderRadius: 1,
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
    width: 48,
    fontFamily: 'Archivo_500Medium',
    fontSize: 10,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
