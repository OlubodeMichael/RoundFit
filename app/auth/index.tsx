import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { CalorieBudgetCard, LIGHT_CALORIE_PALETTE } from '@/components/home/CalorieBudgetCard';

const COLORS = {
  bg:         '#FAFAF8',
  text:       '#111111',
  mid:        '#888888',
  line:       '#E8E3DC',
  lineSoft:   '#EFE9E2',
  accent:     '#F97316',
  accentSoft: 'rgba(249,115,22,0.07)',
  dark:       '#131318',
  green:      '#22C55E',
};

// Static demo data shown on the auth preview card
const DEMO = {
  eaten:      1247,
  goal:       2100,
  burned:     400,
  stepsToday: 4312,
  remaining:  1647,
  dateLabel:  'Today · May 14',
};

export default function AuthLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const logoFade    = useRef(new Animated.Value(0)).current;
  const logoY       = useRef(new Animated.Value(-10)).current;
  const streakFade  = useRef(new Animated.Value(0)).current;
  const streakX     = useRef(new Animated.Value(-14)).current;
  const cardFade    = useRef(new Animated.Value(0)).current;
  const floatAnim   = useRef(new Animated.Value(22)).current;  // entrance offset → float loop
  const liveFade    = useRef(new Animated.Value(0)).current;
  const liveY       = useRef(new Animated.Value(8)).current;
  const btnsFade    = useRef(new Animated.Value(0)).current;
  const btnsY       = useRef(new Animated.Value(14)).current;
  const breathe     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    Animated.parallel([
      Animated.timing(logoFade,    { toValue: 1, duration: 480, delay:  60, useNativeDriver: true }),
      Animated.timing(logoY,       { toValue: 0, duration: 480, delay:  60, easing: ease, useNativeDriver: true }),
      Animated.timing(streakFade,  { toValue: 1, duration: 560, delay: 180, useNativeDriver: true }),
      Animated.timing(streakX,     { toValue: 0, duration: 560, delay: 180, easing: ease, useNativeDriver: true }),
      Animated.timing(cardFade,    { toValue: 1, duration: 650, delay: 260, useNativeDriver: true }),
      Animated.timing(liveFade,    { toValue: 1, duration: 480, delay: 440, useNativeDriver: true }),
      Animated.timing(liveY,       { toValue: 0, duration: 480, delay: 440, easing: ease, useNativeDriver: true }),
      Animated.timing(btnsFade,    { toValue: 1, duration: 460, delay: 560, useNativeDriver: true }),
      Animated.timing(btnsY,       { toValue: 0, duration: 460, delay: 560, easing: ease, useNativeDriver: true }),
    ]).start();

    // Card float: slide in from below, then gently bob forever
    Animated.sequence([
      Animated.timing(floatAnim, {
        toValue: 0, duration: 700, delay: 260,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -8, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue:  0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dotOpac = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <View style={[s.root, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16 }]}>

      <View style={s.bgBlob} pointerEvents="none" />

      {/* ── Wordmark ── */}
      <Animated.View style={[s.logoRow, { opacity: logoFade, transform: [{ translateY: logoY }] }]}>
        <Text style={s.logo}>Round<Text style={s.logoAccent}>Fit</Text></Text>
        <View style={s.logoDot} />
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* ── Preview cards — centred, floating ── */}
      <Animated.View style={[s.cardsSection, { opacity: cardFade, transform: [{ translateY: floatAnim }] }]}>

        <Animated.View style={[s.streakBadge, { opacity: streakFade, transform: [{ translateX: streakX }] }]}>
          <Text style={s.streakFlame}>🔥</Text>
          <View>
            <Text style={s.streakDays}>14 days</Text>
            <Text style={s.streakSub}>STREAK</Text>
          </View>
        </Animated.View>

        <CalorieBudgetCard
            P={LIGHT_CALORIE_PALETTE}
            eaten={DEMO.eaten}
            goal={DEMO.goal}
            burned={DEMO.burned}
            stepsToday={DEMO.stepsToday}
            remaining={DEMO.remaining}
            dateLabel={DEMO.dateLabel}
          />

        <Animated.View style={[s.livePill, { opacity: liveFade, transform: [{ translateY: liveY }] }]}>
          <Animated.View style={[s.liveDot, { opacity: dotOpac }]} />
          <Text style={s.liveTag}>LIVE</Text>
          <Text style={s.liveRunner}>🏃</Text>
          <Text style={s.liveActivity}>Walk 85 min · 434 kcal</Text>
        </Animated.View>

      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* ── Actions — pinned bottom ── */}
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
    flex:              1,
    backgroundColor:   COLORS.bg,
    paddingHorizontal: 22,
  },

  bgBlob: {
    position:        'absolute',
    top:             -70,
    right:           -80,
    width:           230,
    height:          230,
    borderRadius:    115,
    backgroundColor: COLORS.accentSoft,
  },

  logoRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo:       { fontFamily: 'Syne_800ExtraBold', fontSize: 20, color: COLORS.text, letterSpacing: -0.2 },
  logoAccent: { color: COLORS.accent },
  logoDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },

  cardsSection: { gap: 8, marginBottom: 20 },

  streakBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    alignSelf:         'flex-start',
    backgroundColor:   '#FFFFFF',
    borderRadius:      14,
    paddingVertical:   8,
    paddingHorizontal: 13,
    borderWidth:       1,
    borderColor:       COLORS.lineSoft,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.06,
    shadowRadius:      8,
    elevation:         3,
  },
  streakFlame: { fontSize: 20 },
  streakDays:  { fontFamily: 'Syne_700Bold', fontSize: 13, color: COLORS.text },
  streakSub:   { fontFamily: 'Syne_700Bold', fontSize: 9, letterSpacing: 1.4, color: COLORS.mid, marginTop: 1 },

  livePill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               7,
    alignSelf:         'flex-end',
    backgroundColor:   COLORS.dark,
    borderRadius:      50,
    paddingVertical:   9,
    paddingHorizontal: 14,
    marginTop:         -18,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.26,
    shadowRadius:      10,
    elevation:         8,
  },
  liveDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green },
  liveTag:      { fontFamily: 'Syne_700Bold', fontSize: 10, color: COLORS.green, letterSpacing: 1.2 },
  liveRunner:   { fontSize: 12 },
  liveActivity: { fontSize: 12, color: '#FFFFFF', letterSpacing: 0.2 },

  buttons:    { gap: 0 },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius:    14,
    paddingVertical: 16,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     COLORS.accent,
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.28,
    shadowRadius:    18,
    elevation:       10,
  },
  primaryText:  { color: '#FFF', fontFamily: 'Syne_700Bold', fontSize: 16, letterSpacing: 0.3 },
  primaryArrow: { color: '#FFF', fontFamily: 'Syne_700Bold', fontSize: 16 },

  loginBtn:   { paddingVertical: 14, alignItems: 'center' },
  loginText:  { fontSize: 14, color: COLORS.mid },
  loginAccent: { color: COLORS.accent, fontFamily: 'Syne_700Bold' },
});
