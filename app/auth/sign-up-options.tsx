import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { OnboardingSignupAuth } from '@/components/onboarding/OnboardingSignupAuth';
import { safeBack } from '@/utils/navigation';

const BG = '#F9F8F6';
const INK = '#111110';
const DIM = '#8C8880';
const ORANGE = '#F97316';
const HEALTH_RED = '#FF2D55';

export default function SignUpOptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    name: string; age: string; sex: string;
    height: string; weight: string;
    goal: string; activity: string; unit: string;
  }>();

  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 460,
        delay: 40,
        useNativeDriver: true,
      }),
      Animated.timing(slideY, {
        toValue: 0,
        duration: 440,
        delay: 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const name = params.name?.trim() || 'there';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.accentHalo} pointerEvents="none" />

      <View style={s.topBar}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => safeBack(router, { pathname: '/onboarding/reveal', params })}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to your plan"
        >
          <Ionicons name="arrow-back" size={19} color={INK} />
        </TouchableOpacity>

        <View style={s.brand}>
          <Image
            source={require('@/assets/images/roundfit-logo-transparent.png')}
            style={s.brandLogo}
            resizeMode="contain"
          />
          <Text style={s.brandText}>oundfit</Text>
        </View>
      </View>

      <Animated.View
        style={[
          s.hero,
          { opacity: fade, transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={s.badge}>
          <View style={s.badgeDot} />
          <Text style={s.badgeText}>PLAN READY</Text>
        </View>

        <Text style={s.headline}>
          Built for <Text style={s.emphasis}>you</Text>,{`\n`}{name}.
        </Text>
        <Text style={s.sub}>
          Your personal targets are ready. Create an account to save your plan.
        </Text>

        <View style={s.planPanel}>
          <View style={s.planTopRow}>
            <View style={s.checkDisc}>
              <Ionicons name="checkmark" size={22} color="#FFFFFF" />
            </View>
            <View style={s.planCopy}>
              <Text style={s.planEyebrow}>PERSONAL PLAN</Text>
              <Text style={s.planTitle}>Ready to save</Text>
            </View>
            <View style={s.readyTag}>
              <Text style={s.readyTagText}>READY</Text>
            </View>
          </View>

          <View style={s.planDivider} />

          <View style={s.planMeta}>
            <View style={s.metaItem}>
              <Ionicons name="flame-outline" size={16} color={ORANGE} />
              <Text style={s.metaText}>Targets</Text>
            </View>
            <View style={s.metaItem}>
              <Ionicons name="analytics-outline" size={16} color={ORANGE} />
              <Text style={s.metaText}>Progress</Text>
            </View>
            <View style={s.metaItem}>
              <Ionicons name="heart" size={15} color={HEALTH_RED} />
              <Text style={s.metaText}>Health</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <View style={[s.authSheet, { paddingBottom: insets.bottom + 14 }]}>
        <Text style={s.authTitle}>Create your account</Text>
        <OnboardingSignupAuth params={params} animateIn showLoginLink />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: BG,
  },
  accentHalo: {
    position: 'absolute',
    top: 118,
    right: -108,
    width: 286,
    height: 286,
    borderRadius: 143,
    backgroundColor: 'rgba(249,115,22,0.10)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EAE6E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLogo: { width: 25, height: 23 },
  brandText: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 16,
    lineHeight: 18,
    color: INK,
    letterSpacing: -0.45,
    marginLeft: -1,
    transform: [{ translateY: 0.5 }],
  },
  hero: { flex: 1, paddingHorizontal: 24, paddingTop: 44, gap: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ORANGE },
  badgeText: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 10,
    color: '#746D65',
    letterSpacing: 1.2,
  },
  headline: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 40,
    letterSpacing: -1.8,
    lineHeight: 45,
    color: INK,
  },
  emphasis: {
    color: ORANGE,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  sub: {
    maxWidth: 340,
    fontFamily: 'Archivo_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: DIM,
  },
  planPanel: {
    marginTop: 20,
    padding: 17,
    borderRadius: 20,
    backgroundColor: INK,
    shadowColor: '#111110',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 5,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkDisc: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCopy: { flex: 1, gap: 2, paddingHorizontal: 12 },
  planEyebrow: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: ORANGE,
  },
  planTitle: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 17,
    letterSpacing: -0.25,
    color: '#FFFFFF',
  },
  readyTag: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#292927',
  },
  readyTagText: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 8,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  planDivider: { height: StyleSheet.hairlineWidth, marginVertical: 14, backgroundColor: '#31312F' },
  planMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: 'Archivo_500Medium', fontSize: 11.5, color: '#C9C7C3' },
  authSheet: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: BG,
  },
  authTitle: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 18,
    letterSpacing: -0.3,
    color: INK,
    textAlign: 'left',
    marginBottom: 14,
  },
});
