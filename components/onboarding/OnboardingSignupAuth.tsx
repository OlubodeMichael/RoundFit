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
import { useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { PRIVACY_URL, TERMS_URL } from '@/constants/legal';
import * as WebBrowser from 'expo-web-browser';
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

const ERROR_LABELS: Record<AuthError, string> = {
  EMAIL_IN_USE: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  API_KEY_INVALID: 'App configuration error. Please update the app.',
  WEAK_PASSWORD: 'Password must be at least 8 characters.',
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
    profileSetupPending,
    isLoading,
    status,
    user,
    error,
    clearError,
  } = useAuth();

  const profile = useMemo(() => buildOnboardingProfile(params), [params]);
  const canFinish = hasOnboardingParams(params);
  const finishingRef = useRef(false);
  const [settingUpProfile, setSettingUpProfile] = useState(false);

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

  const finishOAuthSetup = async () => {
    if (!canFinish) {
      router.replace('/onboarding/complete-profile');
      return;
    }
    if (finishingRef.current) return;
    finishingRef.current = true;
    setSettingUpProfile(true);
    try {
      const ok = await setupOAuthProfile(profile);
      if (!ok) {
        finishingRef.current = false;
        setSettingUpProfile(false);
      }
    } catch {
      finishingRef.current = false;
      setSettingUpProfile(false);
    }
  };

  useEffect(() => {
    if (!profileSetupPending || !canFinish) return;
    void finishOAuthSetup();
  }, [profileSetupPending, canFinish]); // eslint-disable-line react-hooks/exhaustive-deps

  const showLoading = isLoading || settingUpProfile;
  const awaitingOAuthSave = profileSetupPending && canFinish;

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

        {profileSetupPending && !canFinish && (
          <TouchableOpacity
            style={s.incompleteBanner}
            activeOpacity={0.85}
            onPress={() => router.replace('/onboarding/complete-profile')}
          >
            <Ionicons name="information-circle-outline" size={18} color={ORANGE} />
            <Text style={s.incompleteText}>
              Your plan data is incomplete. Tap here to restart setup from the beginning.
            </Text>
          </TouchableOpacity>
        )}

        {awaitingOAuthSave ? (
          <TouchableOpacity
            style={[s.savePlanBtn, { opacity: showLoading ? 0.55 : 1 }]}
            activeOpacity={0.84}
            disabled={showLoading}
            onPress={() => void finishOAuthSetup()}
          >
            <Text style={s.savePlanBtnText}>Save my plan & continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[s.appleBtn, { opacity: showLoading ? 0.55 : 1 }]}
              activeOpacity={0.84}
              disabled={showLoading}
              onPress={() => void signInWithOAuth('apple')}
              accessibilityRole="button"
              accessibilityLabel="Continue with Apple"
            >
              <Ionicons name="logo-apple" size={20} color="#FFF" />
              <Text style={s.appleBtnText}>Continue with Apple</Text>
            </TouchableOpacity>

            <View style={s.secondaryRow}>
              <TouchableOpacity
                style={[s.secondaryBtn, { opacity: showLoading ? 0.55 : 1 }]}
                activeOpacity={0.84}
                disabled={showLoading}
                onPress={() => void signInWithOAuth('google')}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <GoogleLogo size={18} />
                <Text style={s.secondaryBtnText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.secondaryBtn, { opacity: showLoading ? 0.55 : 1 }]}
                activeOpacity={0.84}
                disabled={showLoading}
                onPress={() => router.push({ pathname: '/auth/sign-up', params })}
                accessibilityRole="button"
                accessibilityLabel="Continue with email"
              >
                <Ionicons name="mail-outline" size={19} color={INK} />
                <Text style={s.secondaryBtnText}>Email</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {awaitingOAuthSave && (
          <View style={s.savingNote}>
            <Ionicons name="lock-closed" size={13} color={DIM} />
            <Text style={s.savingNoteText}>Your account is connected. Finish saving your plan.</Text>
          </View>
        )}

        <Text style={s.legal}>
          By continuing you agree to our{' '}
          <Text
            style={s.legalAccent}
            suppressHighlighting
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
          >
            Terms
          </Text>
          {' & '}
          <Text
            style={s.legalAccent}
            suppressHighlighting
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          >
            Privacy Policy
          </Text>
        </Text>

        {showLoginLink && !profileSetupPending && (
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
  buttons: { gap: 10 },
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
  incompleteBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(249,115,22,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  incompleteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: INK,
    fontWeight: '500',
  },
  savePlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ORANGE,
    borderRadius: 16,
    paddingVertical: 18,
  },
  savePlanBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000000',
    minHeight: 56,
    borderRadius: 999,
    paddingHorizontal: 18,
  },
  appleBtnText: { color: '#FFF', fontFamily: 'Archivo_600SemiBold', fontSize: 15 },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F2EFEB',
    borderRadius: 18,
  },
  secondaryBtnText: { color: INK, fontFamily: 'Archivo_600SemiBold', fontSize: 14 },
  savingNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  savingNoteText: { fontFamily: 'Archivo_400Regular', fontSize: 11, color: DIM },
  legal: {
    fontSize: 12,
    color: DIM,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 2,
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
