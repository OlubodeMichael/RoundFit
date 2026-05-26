import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { hasActiveUserSession } from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';

const BG = '#FAFAF8';
const INK = '#111110';
const DIM = '#8C8880';
const ORANGE = '#F97316';
const LINE = '#EBE8E2';

const STEPS = [
  {
    title: 'Your basics',
    sub: 'Age, sex, height, and weight so we can size your plan.',
  },
  {
    title: 'Your goals',
    sub: 'What you are training for and how active you are.',
  },
  {
    title: 'Save your profile',
    sub: 'Linked to your Apple or Google account  about two minutes.',
  },
];

export default function CompleteProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, user, signOut } = useAuth();

  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(16)).current;
  const listFade = useRef(new Animated.Value(0)).current;
  const btnFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    Animated.stagger(80, [
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 0, duration: 420, easing: ease, useNativeDriver: true }),
      ]),
      Animated.timing(listFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(btnFade, { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasActiveUserSession(status, user)) {
      router.replace('/(tabs)');
    } else if (status === 'unauthenticated') {
      router.replace('/auth');
    }
  }, [status, user, router]);

  return (
    <View
      style={[
        s.root,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={s.bgBlob} pointerEvents="none" />

      <TouchableOpacity
        style={s.backBtn}
        onPress={() => void signOut()}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={20} color={INK} />
      </TouchableOpacity>

      <View style={s.content}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slideY }] }}>
          <View style={s.eyebrowRow}>
            <View style={s.eyebrowDash} />
            <Text style={s.eyebrow}>ONE MORE STEP</Text>
          </View>

          <Text style={s.headline}>
            {"You're signed in."}
          </Text>
          <Text style={s.headlineAccent}>Create your profile.</Text>

          <Text style={s.sub}>
            Your account is connected. We just need a few details to build your
            calorie and training plan.
          </Text>
        </Animated.View>

        <Animated.View style={[s.stepCard, { opacity: listFade }]}>
          {STEPS.map((step, index) => (
            <View
              key={step.title}
              style={[s.stepRow, index < STEPS.length - 1 && s.stepRowBorder]}
            >
              <Text style={s.stepIndex}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={s.stepCopy}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepSub}>{step.sub}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[s.footer, { opacity: btnFade }]}>
        <TouchableOpacity
          style={s.cta}
          activeOpacity={0.88}
          onPress={() =>
            router.push({ pathname: '/onboarding/age-sex', params: { from: 'login' } })
          }
        >
          <Text style={s.ctaText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
  },
  bgBlob: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(249,115,22,0.07)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#ECEAE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  content: {
    flex: 1,
    gap: 28,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  eyebrowDash: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: ORANGE,
  },
  eyebrow: {
    fontFamily: 'Syne_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: ORANGE,
  },
  headline: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 48,
    color: INK,
  },
  headlineAccent: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 48,
    color: ORANGE,
    marginBottom: 14,
  },
  sub: {
    fontSize: 16,
    lineHeight: 24,
    color: DIM,
    maxWidth: 320,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: LINE,
    overflow: 'hidden',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  stepRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  stepIndex: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 13,
    letterSpacing: 0.5,
    color: ORANGE,
    marginTop: 3,
    minWidth: 24,
  },
  stepCopy: {
    flex: 1,
    gap: 6,
  },
  stepTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 26,
    color: INK,
  },
  stepSub: {
    fontSize: 16,
    lineHeight: 23,
    color: DIM,
  },
  footer: {
    paddingTop: 16,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: INK,
    borderRadius: 16,
    paddingVertical: 18,
  },
  ctaText: {
    fontFamily: 'Syne_700Bold',
    color: '#FFF',
    fontSize: 16,
    letterSpacing: 0.1,
  },
});
