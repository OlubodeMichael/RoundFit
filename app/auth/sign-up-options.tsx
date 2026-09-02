import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { OnboardingSignupAuth } from '@/components/onboarding/OnboardingSignupAuth';
import { safeBack } from '@/utils/navigation';

const BG = '#F9F8F6';
const INK = '#111110';
const DIM = '#8C8880';
const ORANGE = '#F97316';
const HEALTH_RED = '#FF2D55';

const PLAN_BENEFITS = [
  { icon: 'flame-outline' as const, label: 'Daily targets' },
  { icon: 'analytics-outline' as const, label: 'Progress tracking' },
  { icon: 'heart' as const, label: 'Health sync', health: true },
];

export default function SignUpOptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 800;
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
      <View style={[s.gradientCorner, { height: height * 0.5 }]} pointerEvents="none">
        <LinearGradient
          colors={[
            'rgba(17,17,16,0.20)',
            'rgba(249,115,22,0.54)',
            'rgba(255,196,153,0.34)',
            'rgba(249,248,246,0)',
          ]}
          locations={[0, 0.32, 0.68, 1]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        >
          <View style={s.gradientDarkOrb} />
          <View style={s.gradientLightOrb} />
          <View style={s.gradientHotOrb} />
          <BlurView intensity={58} tint="light" style={StyleSheet.absoluteFillObject} />
          <LinearGradient
            colors={['rgba(249,248,246,0)', BG]}
            locations={[0.42, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </LinearGradient>
      </View>

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
          compact && s.heroCompact,
          { opacity: fade, transform: [{ translateY: slideY }] },
        ]}
      >
        <View style={s.badge}>
          <View style={s.badgeDot} />
          <Text style={s.badgeText}>YOUR PLAN IS READY</Text>
        </View>

        <Text style={[s.headline, compact && s.headlineCompact]}>
          Save your plan,{`\n`}<Text style={s.name}>{name}.</Text>
        </Text>
        <Text style={s.sub}>
          Create your account to keep your targets, progress and health data together.
        </Text>

        <LinearGradient
          colors={['#FF7C18', '#F45F0B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.planCard, compact && s.planCardCompact]}
        >
          <View style={s.planCardTop}>
            <View style={s.shieldDisc}>
              <Ionicons name="shield-checkmark" size={25} color={ORANGE} />
            </View>
            <View style={s.planCopy}>
              <Text style={s.planEyebrow}>PERSONAL PLAN</Text>
              <Text style={s.planTitle}>Ready to be saved</Text>
            </View>
            <View style={s.readyPill}>
              <Text style={s.readyPillText}>READY</Text>
            </View>
          </View>

          <View style={s.planRule} />
          <View style={s.planBenefits}>
            {PLAN_BENEFITS.map((benefit) => (
              <View key={benefit.label} style={s.planBenefit}>
                <View style={[s.planBenefitIcon, benefit.health && s.planBenefitIconHealth]}>
                  <Ionicons
                    name={benefit.icon}
                    size={14}
                    color={benefit.health ? HEALTH_RED : '#FFFFFF'}
                  />
                </View>
                <Text style={s.planBenefitText}>{benefit.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </Animated.View>

      <View style={[s.authSheet, { paddingBottom: insets.bottom + 14 }]}>
        <View style={s.sheetHandle} />
        <Text style={s.authTitle}>Choose how to continue</Text>
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
  gradientCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  gradientDarkOrb: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: 'rgba(17,17,16,0.18)',
    top: -150,
    left: -92,
  },
  gradientLightOrb: {
    position: 'absolute',
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: 'rgba(255,226,203,0.70)',
    top: -82,
    right: -112,
  },
  gradientHotOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(249,115,22,0.56)',
    top: 34,
    right: 16,
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
  hero: { flex: 1, paddingHorizontal: 24, paddingTop: 24, gap: 10 },
  heroCompact: { paddingTop: 14, gap: 7 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ORANGE },
  badgeText: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 10,
    color: DIM,
    letterSpacing: 1.2,
  },
  headline: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 44,
    letterSpacing: -2.1,
    lineHeight: 48,
    color: INK,
  },
  headlineCompact: { fontSize: 36, lineHeight: 40 },
  name: {
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
  planCard: {
    marginTop: 10,
    padding: 16,
    borderRadius: 24,
    shadowColor: '#B94300',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 4,
  },
  planCardCompact: { marginTop: 4, paddingVertical: 12 },
  planCardTop: { flexDirection: 'row', alignItems: 'center' },
  shieldDisc: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planCopy: { flex: 1, gap: 2, paddingHorizontal: 12 },
  planEyebrow: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 8.5,
    letterSpacing: 1.1,
    color: '#FFFFFF',
    opacity: 0.72,
  },
  planTitle: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  readyPill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(17,17,16,0.78)',
  },
  readyPillText: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 8,
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  planRule: { height: 1, backgroundColor: 'rgba(255,255,255,0.28)', marginVertical: 13 },
  planBenefits: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  planBenefit: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planBenefitIcon: {
    width: 23,
    height: 23,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBenefitIconHealth: { backgroundColor: '#FFFFFF' },
  planBenefitText: {
    fontFamily: 'Archivo_500Medium',
    fontSize: 9.5,
    color: '#FFFFFF',
  },
  authSheet: {
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2DED8',
    marginBottom: 10,
  },
  authTitle: {
    fontFamily: 'Archivo_600SemiBold',
    fontSize: 14,
    color: INK,
    textAlign: 'center',
    marginBottom: 12,
  },
});
