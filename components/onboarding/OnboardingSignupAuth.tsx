import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import {
  hasActiveUserSession,
  type AuthError,
} from '@/context/auth-context';
import { useAuth } from '@/hooks/use-auth';
import {
  buildOnboardingProfile,
  hasOnboardingParams,
  type OnboardingRouteParams,
} from '@/utils/onboarding-profile';

const ORANGE = '#F97316';
const INK = '#111110';
const DIM = '#8C8880';
const RULE = '#E6E2DA';

const ERROR_LABELS: Record<AuthError, string> = {
  EMAIL_IN_USE: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  WEAK_PASSWORD: 'Password must be at least 6 characters.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  OAUTH_FAILED: 'Sign in failed. Please try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

interface OnboardingSignupAuthProps {
  params: OnboardingRouteParams;
  /** When true, buttons fade/slide in on mount. */
  animateIn?: boolean;
  /** Show "Already have an account?" link (sign-up-options screen). */
  showLoginLink?: boolean;
}

export function OnboardingSignupAuth({
  params,
  animateIn = false,
  showLoginLink = false,
}: OnboardingSignupAuthProps) {
  const router = useRouter();
  const {
    signInWithOAuth,
    setupOAuthProfile,
    oauthProfilePending,
    isLoading,
    status,
    user,
    error,
    clearError,
  } = useAuth();

  const profile = useMemo(() => buildOnboardingProfile(params), [params]);
  const canFinish = hasOnboardingParams(params);
  const finishingRef = useRef(false);

  const btnsFade = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  const btnsY = useRef(new Animated.Value(animateIn ? 16 : 0)).current;

  useEffect(() => {
    if (!animateIn) return;
    Animated.parallel([
      Animated.timing(btnsFade, {
        toValue: 1,
        duration: 480,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(btnsY, {
        toValue: 0,
        duration: 440,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [animateIn, btnsFade, btnsY]);

  useEffect(() => {
    if (hasActiveUserSession(status, user)) {
      router.replace('/(tabs)');
    }
  }, [status, user, router]);

  useEffect(() => {
    if (!oauthProfilePending || !canFinish) return;

    const run = async () => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      try {
        await setupOAuthProfile(profile);
      } finally {
        finishingRef.current = false;
      }
    };

    void run();
  }, [oauthProfilePending, canFinish, profile, setupOAuthProfile]);

  const showLoading = isLoading || (oauthProfilePending && canFinish);

  return (
    <View>
      <Animated.View
        style={[s.buttons, { opacity: btnsFade, transform: [{ translateY: btnsY }] }]}
      >
        {error && (
          <TouchableOpacity style={s.errorBanner} onPress={clearError} activeOpacity={0.8}>
            <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
            <Text style={s.errorText}>{ERROR_LABELS[error] ?? ERROR_LABELS.UNKNOWN}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[s.appleBtn, { opacity: showLoading ? 0.55 : 1 }]}
          activeOpacity={0.84}
          disabled={showLoading}
          onPress={() => signInWithOAuth('apple')}
        >
          <Ionicons name="logo-apple" size={20} color="#FFF" />
          <Text style={s.appleBtnText}>Continue with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.outlineBtn, { opacity: showLoading ? 0.55 : 1 }]}
          activeOpacity={0.84}
          disabled={showLoading}
          onPress={() => signInWithOAuth('google')}
        >
          <GoogleLogo size={18} />
          <Text style={s.outlineBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.outlineBtn, { opacity: showLoading ? 0.55 : 1 }]}
          activeOpacity={0.84}
          disabled={showLoading}
          onPress={() => router.push({ pathname: '/auth/sign-up', params })}
        >
          <Ionicons name="mail-outline" size={19} color={INK} />
          <Text style={s.outlineBtnText}>Continue with email</Text>
        </TouchableOpacity>

        <Text style={s.legal}>
          By continuing you agree to our{' '}
          <Text style={s.legalAccent}>Terms</Text>
          {' & '}
          <Text style={s.legalAccent}>Privacy Policy</Text>
        </Text>

        {showLoginLink && (
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => router.replace('/auth/auth-options')}
          >
            <Text style={s.loginText}>
              Already have an account?{'  '}
              <Text style={s.loginAccent}>Log in</Text>
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      <Modal visible={showLoading} transparent animationType="fade">
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={s.loadingText}>Setting up your account…</Text>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  buttons: { gap: 12 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  errorText: { flex: 1, fontSize: 13, color: '#EF4444', fontWeight: '500' },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 18,
  },
  appleBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RULE,
    paddingVertical: 17,
  },
  outlineBtnText: { color: INK, fontSize: 15, fontWeight: '700' },
  legal: {
    fontSize: 12,
    color: DIM,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  legalAccent: { color: INK, fontWeight: '600' },
  loginText: { fontSize: 13, fontWeight: '500', color: DIM, textAlign: 'center' },
  loginAccent: { color: ORANGE, fontWeight: '700' },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(249,248,246,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: INK,
  },
});
