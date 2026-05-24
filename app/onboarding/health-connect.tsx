import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Easing, Platform, Image, useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Path } from 'react-native-svg';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { HEALTHKIT_READ_IDENTIFIERS, isExpoGoEnvironment } from '@/utils/healthkit';

const HERO_H = 300;
const CARD_S = 76;
const DOT_R  = 20;

export default function HealthConnectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string;
    goal: string; activity: string; unit: string;
  }>();
  const insets  = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  // ── Layout ─────────────────────────────────────────────────────────────────
  const cx = screenW / 2;
  const cy = HERO_H / 2;   // 150

  // Orange dot: dead center
  const dotCx = cx;
  const dotCy = cy;

  // Apple Health: upper-left, close to dot
  const appleX = cx - 62;
  const appleY = cy - 64;

  // RoundFit: lower-right, close to dot
  const rfX = cx + 60;
  const rfY = cy + 56;

  // Curved path control points — each curve acts like a quarter-circle routed
  // via a right-angle corner:
  //   Curve 1: Apple → ↓ straight down → turns → Dot (control directly below Apple, at dot's y)
  //   Curve 2: Dot → → straight right → turns → RF  (control directly right of Dot, at RF's x)
  const path1 = `M ${appleX} ${appleY} Q ${appleX} ${dotCy} ${dotCx} ${dotCy}`;
  const path2 = `M ${dotCx} ${dotCy} Q ${rfX} ${dotCy} ${rfX} ${rfY}`;

  // ── Animations ─────────────────────────────────────────────────────────────
  const heroFade   = useRef(new Animated.Value(0)).current;
  const heroScale  = useRef(new Animated.Value(0.92)).current;
  const textFade   = useRef(new Animated.Value(0)).current;
  const textY      = useRef(new Animated.Value(20)).current;
  const bottomFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      router.replace({ pathname: '/onboarding/reveal', params });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    Animated.parallel([
      Animated.timing(heroFade,  { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(heroScale, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();

    const t1 = setTimeout(() => Animated.parallel([
      Animated.timing(textFade, { toValue: 1, duration: 460, useNativeDriver: true }),
      Animated.timing(textY,    { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(), 220);

    const t2 = setTimeout(() =>
      Animated.timing(bottomFade, { toValue: 1, duration: 380, useNativeDriver: true }).start(),
    500);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS !== 'ios') return null;

  const expoGo     = isExpoGoEnvironment();
  const goToReveal = () => router.push({ pathname: '/onboarding/reveal', params });

  const handleConnect = async () => {
    if (!expoGo) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { requestAuthorization } = require('@kingstinct/react-native-healthkit');
        await requestAuthorization({ toRead: HEALTHKIT_READ_IDENTIFIERS });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('@roundfit/health_connected', 'true');
      } catch {
        // HealthKit unavailable, proceed anyway
      }
    }
    goToReveal();
  };


  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar
          step={params.sex === 'female' ? 12 : 9}
          total={params.sex === 'female' ? 12 : 9}
          backHref={{ pathname: '/onboarding/name', params }}
          isDark={false}
        />
      </View>

      {/* ── Hero illustration ───────────────────────────────────────────────── */}
      <Animated.View style={[{ height: HERO_H }, s.hero, {
        opacity: heroFade, transform: [{ scale: heroScale }],
      }]}>
        {/* Background glow circle */}
        <View style={[s.bgCircle, { top: cy - 118, left: cx - 118 }]} />

        {/* Two independent curved dashed paths */}
        <Svg style={StyleSheet.absoluteFillObject} width={screenW} height={HERO_H}>
          <Path d={path1} stroke="#F97316" strokeWidth={2}
            strokeDasharray="7 5" strokeLinecap="round" fill="none" />
          <Path d={path2} stroke="#F97316" strokeWidth={2}
            strokeDasharray="7 5" strokeLinecap="round" fill="none" />
        </Svg>

        {/* Apple Health card — upper-left, close to dot */}
        <View style={[s.appCard, s.appCardLight, {
          top:  appleY - CARD_S / 2,
          left: appleX - CARD_S / 2,
        }]}>
          <Ionicons name="heart" size={38} color="#FF2D55" />
        </View>

        {/* Orange checkmark dot — center hub */}
        <View style={[s.dotCircle, {
          top:  dotCy - DOT_R,
          left: dotCx - DOT_R,
        }]}>
          <Ionicons name="checkmark" size={14} color="#FFF" />
        </View>

        {/* RoundFit card — lower-right, close to dot */}
        <View style={[s.appCard, s.appCardDark, {
          top:  rfY - CARD_S / 2,
          left: rfX - CARD_S / 2,
        }]}>
          <Image
            source={require('@/assets/icons/ios-dark.png')}
            style={s.rfLogo}
            resizeMode="cover"
          />
        </View>

        {/* Floating labels — anchored to circle center, not screen edges */}
        <View style={[s.floatPill, { top: dotCy - 82, left: dotCx + 46 }]}>
          <Text style={s.floatText}>Steps</Text>
        </View>
        <View style={[s.floatPill, { top: dotCy - 4, left: dotCx - 108 }]}>
          <Text style={s.floatText}>Sleep</Text>
        </View>
        <View style={[s.floatPill, { top: dotCy + 68, left: dotCx - 92 }]}>
          <Text style={s.floatText}>Workouts</Text>
        </View>
        <View style={[s.floatPill, { top: rfY + CARD_S / 2 + 10, left: dotCx + 30 }]}>
          <Text style={s.floatText}>Heart</Text>
        </View>
      </Animated.View>

      {/* ── Headline + body ─────────────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        <Animated.View style={[s.textBlock, { opacity: textFade, transform: [{ translateY: textY }] }]}>
          <Text style={s.headline}>Sync with{'\n'}Apple Health</Text>
          <Text style={s.body}>
            Pull your activity, sleep and heart data into RoundFit, so your plan adapts daily without manual logging.
          </Text>
        </Animated.View>
      </View>

      {/* ── CTAs ────────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.ctaBlock, { opacity: bottomFade }]}>
        <TouchableOpacity style={s.ctaPrimary} activeOpacity={0.85} onPress={handleConnect}>
          <Text style={s.ctaPrimaryText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.ctaSkip} activeOpacity={0.6} onPress={goToReveal}>
          <Text style={s.ctaSkipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#FAFAF8' },
  progress: { marginBottom: 4, paddingHorizontal: 28 },

  hero:     { position: 'relative', width: '100%' },

  bgCircle: {
    position: 'absolute',
    width: 236, height: 236, borderRadius: 118,
    backgroundColor: 'rgba(0,0,0,0.042)',
  },

  appCard: {
    position: 'absolute',
    width: CARD_S, height: CARD_S, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13, shadowRadius: 14,
    elevation: 6,
  },
  appCardLight: { backgroundColor: '#FFFFFF' },
  appCardDark:  { backgroundColor: '#111111' },

  rfLogo: { width: CARD_S, height: CARD_S },

  dotCircle: {
    position: 'absolute',
    width: DOT_R * 2, height: DOT_R * 2, borderRadius: DOT_R,
    backgroundColor: '#F97316',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5, shadowRadius: 8,
    elevation: 5,
  },

  floatPill: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6,
    elevation: 2,
  },
  floatText: { fontSize: 12, fontWeight: '600', color: '#111111', letterSpacing: 0.1 },

  textBlock: { paddingHorizontal: 28, gap: 10, marginTop: 4 },
  headline: {
    fontSize: 34, fontWeight: '900', letterSpacing: -1.5,
    lineHeight: 38, color: '#111111',
  },
  body: { fontSize: 14, lineHeight: 21, color: '#888888', fontWeight: '400' },

  ctaBlock:       { gap: 4, paddingHorizontal: 28 },
  ctaPrimary:     { backgroundColor: '#111111', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  ctaSkip:        { alignItems: 'center', paddingVertical: 10 },
  ctaSkipText:    { fontSize: 14, fontWeight: '500', color: '#888888' },
});
