import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { ProgressBar } from '@/components/onboarding/progress-bar';
import { useHealth } from '@/hooks/use-health';
import { HEALTHKIT_READ_IDENTIFIERS } from '@/utils/healthkit';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const PERMISSIONS: { icon: IoniconsName; label: string; desc: string }[] = [
  { icon: 'footsteps-outline', label: 'Steps & movement',  desc: 'Daily steps, distance walked' },
  { icon: 'flame-outline',     label: 'Calories & effort', desc: 'Active & resting calories, exercise minutes' },
  { icon: 'heart-outline',     label: 'Heart & recovery',  desc: 'Resting heart rate, HRV, VO2 max' },
  { icon: 'moon-outline',      label: 'Sleep',             desc: 'Stages, efficiency, time in bed' },
  { icon: 'barbell-outline',   label: 'Workouts',          desc: 'Exercise sessions & duration' },
  { icon: 'scale-outline',     label: 'Body weight',       desc: 'Weight entries & BMI trends' },
];

export default function HealthConnectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string;
    goal: string; activity: string; unit: string;
  }>();
  const insets = useSafeAreaInsets();
  const { syncFromDevice } = useHealth();

  // ── Entrance animations ───────────────────────────────────────────────────
  const fade       = useRef(new Animated.Value(0)).current;
  const slideY     = useRef(new Animated.Value(24)).current;
  const iconScale  = useRef(new Animated.Value(0.72)).current;
  const iconFade   = useRef(new Animated.Value(0)).current;
  const bottomFade = useRef(new Animated.Value(0)).current;
  const rowAnims   = useRef(
    PERMISSIONS.map(() => ({ fade: new Animated.Value(0), y: new Animated.Value(18) })),
  ).current;

  // Android has no health integration — skip this screen immediately
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      router.replace({ pathname: '/onboarding/reveal', params });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // Headline
    Animated.parallel([
      Animated.timing(fade,   { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    // Icon pops in
    Animated.parallel([
      Animated.timing(iconFade,  { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 6, tension: 90, delay: 150, useNativeDriver: true }),
    ]).start();

    // Permission rows stagger in
    rowAnims.forEach((a, i) => {
      Animated.parallel([
        Animated.timing(a.fade, { toValue: 1, duration: 360, delay: 300 + i * 80, useNativeDriver: true }),
        Animated.timing(a.y,    { toValue: 0, duration: 320, delay: 300 + i * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });

    // Bottom CTA
    Animated.timing(bottomFade, { toValue: 1, duration: 400, delay: 680, useNativeDriver: true }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (Platform.OS !== 'ios') return null;

  const bg   = '#FAFAF8';
  const hi   = '#111111';
  const mid  = '#888';
  const lo   = '#E8E3DC';
  const surf = '#FFFFFF';
  const isExpoGo = Constants.executionEnvironment === 'storeClient';

  const goToReveal = () =>
    router.push({ pathname: '/onboarding/reveal', params });

  const handleConnect = async () => {
    if (isExpoGo) {
      goToReveal();
      return;
    }

    if (Platform.OS === 'ios') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { requestAuthorization } = require('@kingstinct/react-native-healthkit');
        await requestAuthorization({ toRead: HEALTHKIT_READ_IDENTIFIERS });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('@roundfit/health_connected', 'true');
        // First sync — fires in background, don't block navigation
        void syncFromDevice();
      } catch {
        // Not available in Expo Go — proceed without HealthKit
      }
    }
    goToReveal();
  };

  const handleSkip = () => goToReveal();

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.progress}>
        <ProgressBar
          step={params.sex === 'female' ? 12 : 9}
          total={params.sex === 'female' ? 12 : 9}
          onBack={() => router.back()}
          isDark={false}
        />
      </View>

      {/* ── Headline ─────────────────────────────────────────────────────── */}
      <Animated.View style={[{ opacity: fade, transform: [{ translateY: slideY }] }]}>
        <Text style={[s.headline, { color: hi }]}>Connect{'\n'}Health app.</Text>
        <Text style={[s.sub, { color: mid }]}>
          RoundFit reads your Apple Health data to give you a complete picture — no manual logging.
        </Text>
      </Animated.View>

      {/* ── Health icon ──────────────────────────────────────────────────── */}
      <Animated.View style={[s.iconArea, { opacity: iconFade, transform: [{ scale: iconScale }] }]}>
        <View style={s.glowOuter} />
        <View style={[s.glowInner, { backgroundColor: 'rgba(249,115,22,0.10)' }]} />
        <View style={[s.iconCard, { backgroundColor: surf, shadowColor: '#1A0800' }]}>
          <Ionicons name="heart" size={44} color="#F97316" />
        </View>
        <View style={[s.appleBadge, { backgroundColor: surf, borderColor: lo }]}>
          <Text style={s.appleBadgeText}>Apple Health</Text>
        </View>
      </Animated.View>

      {/* ── Permissions list ─────────────────────────────────────────────── */}
      <View style={s.list}>
        {PERMISSIONS.map((p, i) => (
          <Animated.View
            key={p.label}
            style={[
              s.row,
              { backgroundColor: surf, borderColor: lo },
              { opacity: rowAnims[i].fade, transform: [{ translateY: rowAnims[i].y }] },
            ]}
          >
            <View style={s.iconWrap}>
              <Ionicons name={p.icon} size={20} color="#F97316" />
            </View>
            <View style={s.rowText}>
              <Text style={[s.rowLabel, { color: hi }]}>{p.label}</Text>
              <Text style={[s.rowDesc,  { color: mid }]}>{p.desc}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color="rgba(249,115,22,0.55)" />
          </Animated.View>
        ))}
      </View>

      <View style={{ flex: 1, minHeight: 12 }} />

      {/* ── CTAs ─────────────────────────────────────────────────────────── */}
      <Animated.View style={[s.ctaBlock, { opacity: bottomFade }]}>
        <TouchableOpacity style={s.ctaPrimary} activeOpacity={0.85} onPress={handleConnect}>
          <Ionicons name="heart" size={17} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={s.ctaPrimaryText}>{isExpoGo ? 'Continue' : 'Connect Health'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.ctaSkip} activeOpacity={0.6} onPress={handleSkip}>
          <Text style={[s.ctaSkipText, { color: mid }]}>Skip for now</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root:     { flex: 1, paddingHorizontal: 28 },
  progress: { marginBottom: 8 },

  headline: { fontSize: 40, fontWeight: '900', letterSpacing: -2, lineHeight: 44, marginBottom: 10 },
  sub:      { fontSize: 14, lineHeight: 21, fontWeight: '400', marginBottom: 0 },

  // ── Health icon ────────────────────────────────────────────────────────
  iconArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
    marginVertical: 20,
  },
  glowOuter: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(249,115,22,0.06)',
  },
  glowInner: {
    position: 'absolute',
    width: 100, height: 100, borderRadius: 50,
  },
  iconCard: {
    width: 84, height: 84, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 8,
  },
  appleBadge: {
    position: 'absolute',
    bottom: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  appleBadgeText: {
    fontSize: 11, fontWeight: '600',
    color: '#F97316', letterSpacing: 0.2,
  },

  // ── Permissions list ───────────────────────────────────────────────────
  list: { gap: 10 },
  row:  {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 14, borderWidth: 1,
    gap: 14,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:  { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  rowDesc:  { fontSize: 12, lineHeight: 16 },

  // ── CTAs ───────────────────────────────────────────────────────────────
  ctaBlock:    { gap: 12 },
  ctaPrimary:  {
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F97316',
    borderRadius: 14, paddingVertical: 17,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.30, shadowRadius: 12, elevation: 6,
  },
  ctaPrimaryText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },

  ctaSkip:     { alignItems: 'center', paddingVertical: 6 },
  ctaSkipText: { fontSize: 14, fontWeight: '500' },
});
