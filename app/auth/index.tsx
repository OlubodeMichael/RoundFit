import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';

const CURVE = { easing: Easing.out(Easing.cubic), useNativeDriver: true };

function useEntrance(delay: number, distance = 26) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 750, delay, ...CURVE }),
      Animated.timing(translateY, { toValue: 0, duration: 700, delay, ...CURVE }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { opacity, transform: [{ translateY }] } as const;
}

export default function AuthLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const logoStyle     = useEntrance(80);
  const eyebrowStyle  = useEntrance(220);
  const headlineStyle = useEntrance(350);
  const bodyStyle     = useEntrance(500);
  const buttonsStyle  = useEntrance(620);

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + 32 }]}>

      {/* ── Logo ── */}
      <Animated.View style={[s.logoRow, { paddingTop: insets.top + 24 }, logoStyle]}>
        <Text style={s.logo}>
          Round<Text style={s.logoAccent}>Fit</Text>
        </Text>
      </Animated.View>

      {/* ── Hero ── */}
      <View style={s.hero}>

        <Animated.View style={eyebrowStyle}>
          <Text style={s.eyebrow}>FITNESS · NUTRITION · PROGRESS</Text>
        </Animated.View>

        <Animated.View style={headlineStyle}>
          <Text style={s.headline}>Your body.{'\n'}Your rules.</Text>
        </Animated.View>

        <Animated.View style={[s.ruleBlock, bodyStyle]}>
          <View style={s.rule} />
          <Text style={s.body}>
            Train harder, track smarter, and recover better.{'\n'}Personalized just for you.
          </Text>
        </Animated.View>

      </View>

      {/* ── Buttons ── */}
      <Animated.View style={[s.buttons, buttonsStyle]}>
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
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },

  /* Logo */
  logoRow: {},
  logo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 22,
    color: '#F5F5F5',
    letterSpacing: 0.2,
  },
  logoAccent: {
    color: '#F97316',
  },

  /* Hero */
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Syne_700Bold',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: '#F97316',
  },
  headline: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 58,
    color: '#F5F5F5',
    letterSpacing: -2.5,
    lineHeight: 62,
  },
  ruleBlock: {
    gap: 20,
  },
  rule: {
    width: 48,
    height: 2,
    backgroundColor: '#F97316',
    borderRadius: 1,
  },
  body: {
    fontSize: 16,
    color: '#555',
    lineHeight: 27,
    fontWeight: '400',
  },

  /* Buttons */
  buttons: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#F97316',
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  primaryText: {
    color: '#FFF',
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  ghostBtn: {
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
  },
  ghostText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
});
