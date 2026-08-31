import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { useBurnCoach } from '@/context/burn-coach-context';
import { usePalette } from '@/lib/log-theme';

const SIZE = 56;                 // matches the Log FAB diameter
const RING = 2;                  // record-button ring thickness
const RECORD_RED = '#EF4444';
const PAUSED_GREY = '#71717A';
const DARK_BG = '#111113';
const DARK_EDGE = 'rgba(255,255,255,0.14)';
const LIGHT_BG = '#FFFFFF';
const LIGHT_EDGE = 'rgba(0,0,0,0.08)';
const PULSE_DURATION = 1200;

// ─── BurnCoachRecordButton ──────────────────────────────────────────────────
// Circular record button that floats above the Log tab button. Idle it shows a
// red record dot and opens the burn-calories picker on tap; while a workout is
// recording it pulses and shows a stop square that ends the session on tap.
export function BurnCoachRecordButton() {
  const { isRecording, isPaused, openPicker, end } = useBurnCoach();
  const P = usePalette();
  const accent = isPaused ? PAUSED_GREY : RECORD_RED;
  const buttonBg = P.isDark ? LIGHT_BG : DARK_BG;
  const buttonEdge = P.isDark ? LIGHT_EDGE : DARK_EDGE;

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isRecording || isPaused) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: PULSE_DURATION, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: PULSE_DURATION, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isRecording, isPaused, pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const pulseOpac = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Pressable
      onPress={isRecording ? end : openPicker}
      accessibilityRole="button"
      accessibilityLabel={isRecording ? 'End burn coach workout' : 'Start a burn coach workout'}
      hitSlop={8}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      {isRecording && (
        <Animated.View
          style={[
            styles.pulseRing,
            { borderColor: accent, transform: [{ scale: pulseScale }], opacity: pulseOpac },
          ]}
        />
      )}

      <View style={[styles.button, { backgroundColor: buttonBg, borderColor: buttonEdge }]}>
        {isRecording ? (
          <View style={[styles.stop, { backgroundColor: accent }]} />
        ) : (
          <View style={[styles.dot, { backgroundColor: accent }]} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.94 }],
  },
  pulseRing: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: RING,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  stop: {
    width: 20,
    height: 20,
    borderRadius: 5,
  },
});
