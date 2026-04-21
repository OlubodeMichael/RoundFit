import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';

const COLORS = {
  bg:         '#FAFAF8',
  text:       '#111111',
  mid:        '#888888',
  line:       '#E8E3DC',
  lineSoft:   '#EFE9E2',
  accent:     '#F97316',
  accentSoft: 'rgba(249,115,22,0.10)',
};

const RING = 320;
const MID  = RING * 0.60;
const CORE = RING * 0.18;

export default function AuthLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const logoFade    = useRef(new Animated.Value(0)).current;
  const logoY       = useRef(new Animated.Value(-10)).current;
  const ringsFade   = useRef(new Animated.Value(0)).current;
  const ringsScale  = useRef(new Animated.Value(0.86)).current;
  const eyebrowFade = useRef(new Animated.Value(0)).current;
  const eyebrowY    = useRef(new Animated.Value(12)).current;
  const headFade    = useRef(new Animated.Value(0)).current;
  const headY       = useRef(new Animated.Value(22)).current;
  const bodyFade    = useRef(new Animated.Value(0)).current;
  const bodyY       = useRef(new Animated.Value(16)).current;
  const btnsFade    = useRef(new Animated.Value(0)).current;
  const btnsY       = useRef(new Animated.Value(16)).current;

  const arcSpin   = useRef(new Animated.Value(0)).current;
  const orbitSpin = useRef(new Animated.Value(0)).current;
  const breathe   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);

    Animated.parallel([
      Animated.timing(logoFade,    { toValue: 1, duration: 500, delay:  80, useNativeDriver: true }),
      Animated.timing(logoY,       { toValue: 0, duration: 500, delay:  80, easing: ease, useNativeDriver: true }),

      Animated.timing(ringsFade,   { toValue: 1, duration: 900, delay: 140, useNativeDriver: true }),
      Animated.timing(ringsScale,  { toValue: 1, duration: 900, delay: 140, easing: ease, useNativeDriver: true }),

      Animated.timing(eyebrowFade, { toValue: 1, duration: 500, delay: 360, useNativeDriver: true }),
      Animated.timing(eyebrowY,    { toValue: 0, duration: 500, delay: 360, easing: ease, useNativeDriver: true }),

      Animated.timing(headFade,    { toValue: 1, duration: 650, delay: 460, useNativeDriver: true }),
      Animated.timing(headY,       { toValue: 0, duration: 650, delay: 460, easing: ease, useNativeDriver: true }),

      Animated.timing(bodyFade,    { toValue: 1, duration: 500, delay: 640, useNativeDriver: true }),
      Animated.timing(bodyY,       { toValue: 0, duration: 500, delay: 640, easing: ease, useNativeDriver: true }),

      Animated.timing(btnsFade,    { toValue: 1, duration: 500, delay: 780, useNativeDriver: true }),
      Animated.timing(btnsY,       { toValue: 0, duration: 500, delay: 780, easing: ease, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(arcSpin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.timing(orbitSpin, { toValue: 1, duration: 11000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const arcRotate    = arcSpin.interpolate({   inputRange: [0, 1], outputRange: ['0deg',  '360deg'] });
  const orbitRotate  = orbitSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const breatheScale = breathe.interpolate({   inputRange: [0, 1], outputRange: [1, 1.08] });
  const breatheOpac  = breathe.interpolate({   inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View style={[s.root, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24 }]}>

      {/* ─────────── Decorative animated rings ─────────── */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.ringsWrap,
          { opacity: ringsFade, transform: [{ scale: ringsScale }] },
        ]}
      >
        {/* Nested concentric rings */}
        <View style={s.outerRing}>
          <View style={s.midRing}>
            <Animated.View
              style={[
                s.coreDisc,
                { opacity: breatheOpac, transform: [{ scale: breatheScale }] },
              ]}
            >
              <View style={s.coreDot} />
            </Animated.View>
          </View>
        </View>

        {/* Rotating quarter-arc overlay (orange) */}
        <Animated.View style={[s.arcOverlay, { transform: [{ rotate: arcRotate }] }]}>
          <View style={s.arcRing} />
        </Animated.View>

        {/* Orbiting accent dot */}
        <Animated.View style={[s.orbitOverlay, { transform: [{ rotate: orbitRotate }] }]}>
          <View style={s.orbitDot} />
        </Animated.View>
      </Animated.View>

      {/* ─────────── Wordmark ─────────── */}
      <Animated.View style={[s.logoRow, { opacity: logoFade, transform: [{ translateY: logoY }] }]}>
        <Text style={s.logo}>
          Round<Text style={s.logoAccent}>Fit</Text>
        </Text>
        <View style={s.logoDot} />
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* ─────────── Hero copy ─────────── */}
      <View style={s.hero}>
        <Animated.View style={{ opacity: eyebrowFade, transform: [{ translateY: eyebrowY }] }}>
          <View style={s.eyebrowRow}>
            <View style={s.eyebrowDash} />
            <Text style={s.eyebrow}>FITNESS · NUTRITION · PROGRESS</Text>
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: headFade, transform: [{ translateY: headY }] }}>
          <Text style={s.headline}>
            Your body.{'\n'}
            <Text style={s.headlineAccent}>Your rules.</Text>
          </Text>
        </Animated.View>

        <Animated.View style={{ opacity: bodyFade, transform: [{ translateY: bodyY }] }}>
          <Text style={s.body}>
            Train smarter, eat with intention,{'\n'}and recover like it matters.
          </Text>
        </Animated.View>
      </View>

      {/* ─────────── Actions ─────────── */}
      <Animated.View style={[s.buttons, { opacity: btnsFade, transform: [{ translateY: btnsY }] }]}>
        <TouchableOpacity
          style={s.primaryBtn}
          activeOpacity={0.9}
          onPress={() => router.push('/onboarding/value-hook')}
        >
          <Text style={s.primaryText}>Get started</Text>
          <Text style={s.primaryArrow}>  →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.loginBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={s.loginText}>
            Have an account?{'  '}
            <Text style={s.loginAccent}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 28,
  },

  /* ───── Rings ───── */
  ringsWrap: {
    position: 'absolute',
    top:   -RING * 0.30,
    right: -RING * 0.40,
    width:  RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  midRing: {
    width: MID,
    height: MID,
    borderRadius: MID / 2,
    borderWidth: 1,
    borderColor: COLORS.lineSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreDisc: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  arcOverlay: {
    position: 'absolute',
    width:  RING,
    height: RING,
  },
  arcRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderTopColor: COLORS.accent,
    borderRightColor:  'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor:   'transparent',
  },
  orbitOverlay: {
    position: 'absolute',
    width:  RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  orbitDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    marginTop: -5,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 6,
  },

  /* ───── Wordmark ───── */
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 20,
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  logoAccent: { color: COLORS.accent },
  logoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },

  /* ───── Hero ───── */
  hero: { gap: 22, marginBottom: 40 },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eyebrowDash: {
    width: 22,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
  },
  eyebrow: {
    fontFamily: 'Syne_700Bold',
    fontSize: 10,
    letterSpacing: 2.2,
    color: COLORS.accent,
  },

  headline: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 60,
    lineHeight: 64,
    letterSpacing: -3,
    color: COLORS.text,
  },
  headlineAccent: { color: COLORS.accent },

  body: {
    fontSize: 16,
    lineHeight: 25,
    color: COLORS.mid,
  },

  /* ───── Actions ───── */
  buttons: { gap: 4 },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 10,
  },
  primaryText: {
    color: '#FFF',
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  primaryArrow: {
    color: '#FFF',
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
  },
  loginBtn: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: COLORS.mid,
  },
  loginAccent: {
    color: COLORS.accent,
    fontFamily: 'Syne_700Bold',
  },
});
