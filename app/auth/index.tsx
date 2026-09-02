import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRIVACY_URL, TERMS_URL } from '@/constants/legal';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

const HERO = require('../../assets/images/welcome-athlete.png');
const LOGO = require('../../assets/icons/ios-dark.png');
const C = {
  obsidian: '#08080C', cream: '#F7F3EE', orange: '#F97316',
  creamDim: 'rgba(247,243,238,0.72)', creamMute: 'rgba(247,243,238,0.46)',
  hairline: 'rgba(247,243,238,0.18)', glass: 'rgba(10,10,14,0.72)',
};
const HEADLINE = ['every', 'choice', 'counts.'] as const;

/** A full-screen sports poster for signed-out users. */
export default function AuthLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const reveal = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(1.04)).current;
  const contentY = useRef(new Animated.Value(18)).current;

  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle('dark');
  }, []));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: reduceMotion ? 0 : 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(heroScale, { toValue: 1, duration: reduceMotion ? 0 : 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(contentY, { toValue: 0, duration: reduceMotion ? 0 : 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [contentY, heroScale, reduceMotion, reveal]);

  const displaySize = Math.min(70, width * 0.18, height * 0.078);

  return (
    <View style={s.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: heroScale }] }]}>
        <Image source={HERO} resizeMode="cover" style={s.hero} accessibilityIgnoresInvertColors />
      </Animated.View>
      <LinearGradient colors={['rgba(8,8,12,0.22)', 'rgba(8,8,12,0.02)', 'rgba(8,8,12,0.16)']} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(8,8,12,0.14)', 'rgba(8,8,12,0.97)']} locations={[0.52, 0.72, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <Animated.View style={[s.frame, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10, opacity: reveal, transform: [{ translateY: contentY }] }]}>
        <View style={s.brandRow}>
          <Image source={LOGO} style={s.logoMark} resizeMode="cover" accessibilityIgnoresInvertColors />
          <Text style={s.wordmark}>ound<Text style={s.wordmarkAccent}>Fit</Text></Text>
        </View>

        <View style={s.headline}>
          {HEADLINE.map((word, index) => (
            <Text key={word} numberOfLines={1} style={[s.display, { fontSize: displaySize, lineHeight: displaySize * 0.93, letterSpacing: displaySize * -0.045 }, index === 1 && s.displayAccent]}>
              {word}
            </Text>
          ))}
          <Text style={s.kicker}>TRAIN  ·  FUEL  ·  RECOVER</Text>
        </View>

        <View style={s.spacer} />
        <View style={s.actions}>
          <Text style={s.promise}>One clear view of what moves you forward.</Text>
          <TouchableOpacity style={s.primaryBtn} activeOpacity={0.88} onPress={() => router.push('/onboarding/age-sex')} accessibilityRole="button" accessibilityLabel="Get started with RoundFit">
            <Text style={s.primaryText}>Get started</Text>
            <View style={s.arrowDisc}><Ionicons name="arrow-forward" size={17} color={C.obsidian} /></View>
          </TouchableOpacity>
          <TouchableOpacity style={s.loginBtn} activeOpacity={0.75} onPress={() => router.push('/auth/auth-options')} accessibilityRole="button">
            <Text style={s.loginText}>Log in</Text>
          </TouchableOpacity>
          <Text style={s.legal}>
            By continuing you agree to our{' '}
            <Text style={s.legalLink} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>Terms</Text>
            {' '}and{' '}
            <Text style={s.legalLink} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>Privacy Policy</Text>
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.obsidian }, hero: { width: '100%', height: '100%' }, frame: { flex: 1, paddingHorizontal: 22 },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 42, height: 42, borderRadius: 11 },
  wordmark: { marginLeft: -8, fontFamily: 'ArchivoBlack_400Regular', fontSize: 15, color: C.cream, letterSpacing: -0.5 }, wordmarkAccent: { color: C.orange },
  headline: { marginTop: 30 },
  display: { fontFamily: 'ArchivoBlack_400Regular', color: C.cream, includeFontPadding: false, textTransform: 'lowercase' }, displayAccent: { color: C.orange },
  kicker: { marginTop: 15, fontFamily: 'Archivo_600SemiBold', fontSize: 12, color: C.creamDim, letterSpacing: 2.1 }, spacer: { flex: 1 }, actions: { gap: 10 },
  promise: { marginBottom: 2, color: C.cream, fontFamily: 'Archivo_500Medium', fontSize: 14, textAlign: 'center' },
  primaryBtn: { minHeight: 60, paddingLeft: 24, paddingRight: 8, borderRadius: 999, backgroundColor: C.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: C.orange, shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 10 },
  primaryText: { color: '#FFFFFF', fontFamily: 'Archivo_600SemiBold', fontSize: 17 },
  arrowDisc: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  loginBtn: { minHeight: 54, borderRadius: 999, borderWidth: 1, borderColor: C.hairline, backgroundColor: C.glass, alignItems: 'center', justifyContent: 'center' },
  loginText: { color: C.cream, fontFamily: 'Archivo_600SemiBold', fontSize: 16 },
  legal: { marginTop: 2, color: C.creamMute, fontFamily: 'Archivo_500Medium', fontSize: 10.5, lineHeight: 15, textAlign: 'center' },
  legalLink: { color: C.creamDim, fontFamily: 'Archivo_600SemiBold' },
});
