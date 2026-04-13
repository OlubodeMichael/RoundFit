import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';

export default function AuthLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fade  = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 700, delay: 80, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 650, delay: 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 28 }]}>

      {/* Logo mark top-left */}
      <View style={[s.logoRow, { paddingTop: insets.top + 24 }]}>
        <Text style={s.logo}>Calor<Text style={{ color: '#F97316' }}>Fit</Text></Text>
      </View>

      {/* Hero */}
      <Animated.View style={[s.hero, { opacity: fade, transform: [{ translateY: slideY }] }]}>
        <Text style={s.headline}>Your body.{'\n'}Your rules.</Text>
        <View style={s.rule} />
        <Text style={s.body}>
          Track food, train smarter, and see real results — personalized just for you.
        </Text>
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[s.buttons, { opacity: fade }]}>
        <TouchableOpacity
          style={s.primaryBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/onboarding/value-hook')}
        >
          <Text style={s.primaryText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.ghostBtn}
          activeOpacity={0.75}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={s.ghostText}>Log In</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#0A0A0A',
    paddingHorizontal: 28, justifyContent: 'space-between',
  },
  logoRow: {},
  logo:    { fontSize: 18, fontWeight: '700', color: '#F5F5F5', letterSpacing: 0.5 },

  hero:     { flex: 1, justifyContent: 'center', gap: 24 },
  headline: {
    fontSize: 52, fontWeight: '900', color: '#F5F5F5',
    letterSpacing: -2.5, lineHeight: 56,
  },
  rule: { width: 48, height: 2, backgroundColor: '#F97316', borderRadius: 1 },
  body: { fontSize: 16, color: '#555', lineHeight: 26, fontWeight: '400' },

  buttons:    { gap: 12 },
  primaryBtn: {
    backgroundColor: '#F97316', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  ghostBtn:    {
    borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  ghostText: { color: '#777', fontSize: 16, fontWeight: '600' },
});
