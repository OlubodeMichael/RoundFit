import { Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goToAuth = () => router.push('/auth');

  const pulse = useRef(new Animated.Value(1)).current;
  const fade  = useRef(new Animated.Value(0)).current;
  const wordFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Staggered entrance
    Animated.sequence([
      Animated.timing(fade,     { toValue: 1, duration: 600, delay: 200,  useNativeDriver: true }),
      Animated.timing(wordFade, { toValue: 1, duration: 500, delay: 100,  useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TouchableOpacity style={s.root} activeOpacity={1} onPress={goToAuth}>
      {/* Glow layers */}
      <Animated.View style={[s.glowOuter, { transform: [{ scale: pulse }],
        opacity: pulse.interpolate({ inputRange: [1, 1.35], outputRange: [0.22, 0.05] }) }]} />
      <Animated.View style={[s.glowMid, { transform: [{ scale: pulse }],
        opacity: pulse.interpolate({ inputRange: [1, 1.35], outputRange: [0.14, 0.04] }) }]} />

      {/* Monogram */}
      <Animated.View style={[s.center, { opacity: fade }]}>
        <Text style={s.monogram}>CF</Text>
      </Animated.View>

      {/* Wordmark + tagline */}
      <Animated.View style={[s.wordBlock, { opacity: wordFade }]}>
        <Text style={s.wordmark}>
          Calor<Text style={{ color: '#F97316' }}>Fit</Text>
        </Text>
        <Text style={s.tagline}>Fuel your best self.</Text>
      </Animated.View>

      {/* Hint */}
      <Animated.View style={[s.hint, { opacity: wordFade, paddingBottom: insets.bottom + 24 }]}>
        <Text style={s.hintText}>Tap to continue</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#0A0A0A',
    alignItems: 'center', justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 340, height: 340, borderRadius: 170,
    backgroundColor: '#F97316',
  },
  glowMid: {
    position: 'absolute',
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#F97316',
  },
  center:   { alignItems: 'center' },
  monogram: {
    fontSize: 88, fontWeight: '900', color: '#F5F5F5',
    letterSpacing: -4,
  },
  wordBlock: { alignItems: 'center', marginTop: 28, gap: 8 },
  wordmark:  { fontSize: 22, fontWeight: '600', color: '#F5F5F5', letterSpacing: 1 },
  tagline:   { fontSize: 14, fontWeight: '300', color: '#444', letterSpacing: 2 },
  hint:      { position: 'absolute', bottom: 0 },
  hintText:  { fontSize: 12, color: '#333', fontWeight: '500', letterSpacing: 1 },
});
